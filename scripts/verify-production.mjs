import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: `${root}.env` });
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_test')) throw new Error('A dedicated TEST_DATABASE_URL is required');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: database });
await prisma.demoAuthWindow.deleteMany({ where: { id: 'public-demo-auth' } });
const port = process.env.PRODUCTION_CHECK_PORT ?? '4100';
const base = `http://127.0.0.1:${port}/api`;
// Never attach to an unrelated process already using this port.
try { await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) }); throw new Error('Verification port is occupied'); }
catch (error) { if (error.message === 'Verification port is occupied') throw error; }
const child = spawn(process.execPath, ['dist/src/main.js'], {
  cwd: `${root}apps/api`, stdio: 'ignore',
  env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: database, PORT: port, API_HOST: '127.0.0.1', WEB_ORIGIN: 'https://demo.example.test', API_ORIGIN: 'https://demo.example.test', COOKIE_SECURE: 'true', PUBLIC_DEMO_MODE: 'true', TRUST_PROXY_HOPS: '1' },
});
try {
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Production API exited before becoming ready');
    try { healthy = (await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) })).status === 200; } catch { /* starting */ }
    if (healthy) break;
    await delay(100);
  }
  assert(healthy, 'Production readiness failed');
  assert.equal((await fetch(`${base}/customers`)).status, 401);
  const headers = { Origin: 'https://demo.example.test', 'Content-Type': 'application/json' };
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers, body: JSON.stringify({ email: process.env.DEMO_EMPLOYEE_EMAIL ?? 'employee@businessos.demo', password: process.env.DEMO_EMPLOYEE_PASSWORD }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax']) assert(cookie.includes(attribute), attribute);
  const sessionHeaders = { ...headers, Cookie: cookie.split(';')[0] };
  assert.equal((await fetch(`${base}/customers`, { headers: sessionHeaders })).status, 200);
  assert.equal((await fetch(`${base}/customers`, { method: 'POST', headers: sessionHeaders, body: JSON.stringify({ name: 'Forbidden public demo write' }) })).status, 403);
  assert.equal((await fetch(`${base}/auth/forgot-password`, { method: 'POST', headers, body: JSON.stringify({ email: 'employee@businessos.demo' }) })).status, 403);
  assert.equal((await fetch(`${base}/auth/login`, { method: 'POST', headers: { ...headers, Origin: 'https://untrusted.example.test' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/auth/logout`, { method: 'POST', headers: sessionHeaders })).status, 204);
  assert.equal((await fetch(`${base}/auth/me`, { headers: sessionHeaders })).status, 401);
  const demo = await fetch(`${base}/auth/demo`, { method: 'POST', headers });
  assert.equal(demo.status, 200);
  assert.equal((await demo.json()).user.role, 'EMPLOYEE');
  const demoCookie = demo.headers.get('set-cookie');
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=3600']) assert(demoCookie.includes(attribute), attribute);
  const demoHeaders = { ...headers, Cookie: demoCookie.split(';')[0] };
  for (const route of ['customers', 'products', 'orders', 'invoices']) {
    assert.equal((await fetch(`${base}/${route}`, { headers: demoHeaders })).status, 200);
  }
  assert.equal((await fetch(`${base}/customers/e2e_other_customer`, { headers: demoHeaders })).status, 404);
  assert.equal((await fetch(`${base}/employees`, { headers: demoHeaders })).status, 403);
  assert.equal((await fetch(`${base}/auth/logout`, { method: 'POST', headers: demoHeaders })).status, 204);
  assert.equal((await fetch(`${base}/auth/me`, { headers: demoHeaders })).status, 401);

  await prisma.demoAuthWindow.upsert({ where: { id: 'public-demo-auth' }, create: { id: 'public-demo-auth', count: 30, expiresAt: new Date(Date.now() + 60_000) }, update: { count: 30, expiresAt: new Date(Date.now() + 60_000) } });
  assert.equal((await fetch(`${base}/auth/demo`, { method: 'POST', headers })).status, 429);
  // Two independent service instances contend against the same real SQL counter.
  await prisma.demoAuthWindow.deleteMany({ where: { id: 'public-demo-auth' } });
  process.env.PUBLIC_DEMO_MODE = 'true';
  const { AuthService } = require(`${root}apps/api/dist/src/auth/auth.service.js`);
  const services = [new AuthService(prisma), new AuthService(prisma)];
  const results = await Promise.allSettled(Array.from({ length: 35 }, (_, index) => services[index % 2].createDemoSession()));
  const successful = results.filter(result => result.status === 'fulfilled');
  const rejected = results.filter(result => result.status === 'rejected');
  assert.equal(successful.length, 30);
  assert.equal(rejected.length, 5);
  assert(rejected.every(result => result.reason.getStatus() === 429));
  await prisma.session.deleteMany({ where: { tokenHash: { in: successful.map(result => createHash('sha256').update(result.value.token).digest('hex')) } } });
  console.log('Production API verified: real PostgreSQL, secure and passwordless employee sessions, module reads, read-only controls, tenant isolation, revoked tokens and a shared concurrent sign-in limit (30 accepted / 5 rejected). Hosted HTTPS remains unverified.');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const fallback = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(fallback);
  }
  await prisma.demoAuthWindow.deleteMany({ where: { id: 'public-demo-auth' } });
  await prisma.$disconnect();
}

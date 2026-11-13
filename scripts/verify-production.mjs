import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: `${root}.env` });
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_test')) throw new Error('A dedicated TEST_DATABASE_URL is required');
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
  console.log('Production API verified: PostgreSQL readiness, secure-cookie attributes, employee reads, read-only demo, origin rejection and revoked sessions. HTTPS termination itself remains unverified.');
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const fallback = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(fallback);
  }
}

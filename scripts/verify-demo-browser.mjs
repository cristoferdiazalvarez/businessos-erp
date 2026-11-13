import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import https from 'node:https';
import http from 'node:http';

const root = fileURLToPath(new URL('../', import.meta.url));
const apiRequire = createRequire(new URL('../apps/api/package.json', import.meta.url));
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
apiRequire('dotenv').config({ path: `${root}.env` });
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_test')) throw new Error('A dedicated TEST_DATABASE_URL is required');
for (const port of [3000, 4000, 3443]) {
  const occupied = await new Promise(resolve => {
    const request = http.get(`http://127.0.0.1:${port}`, () => resolve(true));
    request.setTimeout(500, () => { request.destroy(); resolve(false); });
    request.on('error', error => resolve(error.code !== 'ECONNREFUSED'));
  });
  if (occupied) throw new Error(`Test port ${port} is occupied; stop only your own BusinessOS processes first`);
}
mkdirSync(`${root}.local`, { recursive: true });
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${root}.local/demo-test.key`, '-out', `${root}.local/demo-test.crt`, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
const origin = 'https://localhost:3443';
const env = { ...process.env, NODE_ENV: 'production', DATABASE_URL: database, DIRECT_DATABASE_URL: database, WEB_ORIGIN: origin, API_ORIGIN: origin, COOKIE_SECURE: 'true', PUBLIC_DEMO_MODE: 'true', TRUST_PROXY_HOPS: '1', API_INTERNAL_ORIGIN: 'http://localhost:4000', NEXT_PUBLIC_API_URL: '/api', NEXT_PUBLIC_DEMO_MODE: 'true' };
const { PrismaClient } = apiRequire('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: database });
await prisma.demoAuthWindow.deleteMany({ where: { id: 'public-demo-auth' } });
const children = [
  spawn(process.execPath, ['dist/src/main.js'], { cwd: `${root}apps/api`, env: { ...env, PORT: '4000', API_HOST: '127.0.0.1' }, stdio: 'ignore' }),
  spawn(process.execPath, [webRequire.resolve('next/dist/bin/next'), 'start', '--port', '3000', '--hostname', '127.0.0.1'], { cwd: `${root}apps/web`, env: { ...env, PORT: '3000' }, stdio: 'ignore' }),
];
const proxy = https.createServer({ key: readFileSync(`${root}.local/demo-test.key`), cert: readFileSync(`${root}.local/demo-test.crt`) }, (request, response) => {
  const upstream = http.request({ hostname: '127.0.0.1', port: 3000, path: request.url, method: request.method, headers: { ...request.headers, 'x-forwarded-proto': 'https' } }, result => {
    response.writeHead(result.statusCode, result.headers);
    result.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end('Test upstream unavailable'); });
  request.pipe(upstream);
});
let browser;
try {
  for (const url of ['http://127.0.0.1:4000/api/health', 'http://127.0.0.1:3000/login']) {
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (children.some(child => child.exitCode !== null)) throw new Error('Demo test process exited during startup');
      try { ready = (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* starting */ }
      if (ready) break;
      await delay(100);
    }
    assert(ready, 'Compiled demo was not ready');
  }
  await new Promise(resolve => proxy.listen(3443, '127.0.0.1', resolve));
  browser = await webRequire('@playwright/test').chromium.launch();
  // Only this local test trusts its temporary self-signed certificate.
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`${origin}/login`);
  await page.getByRole('button', { name: 'Explore demo' }).click();
  await page.waitForURL(`${origin}/app`);
  await page.getByRole('heading', { name: /Good morning/ }).waitFor();
  const cookie = (await context.cookies()).find(cookie => cookie.name === 'businessos_session');
  assert(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax', 'Secure browser session attributes');
  const principal = await (await page.request.get(`${origin}/api/auth/me`)).json();
  assert.equal(principal.user.role, 'EMPLOYEE');
  for (const section of ['customers', 'products', 'orders', 'invoices']) {
    await page.goto(`${origin}/app/${section}`);
    await webRequire('@playwright/test').expect(page.locator('main h1')).toBeVisible();
    await webRequire('@playwright/test').expect(page.getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0);
    assert.equal((await page.request.get(`${origin}/api/${section}`)).status(), 200);
  }
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download invoice/ }).first().click();
  const pdf = await downloaded;
  assert.equal(readFileSync(await pdf.path()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await page.request.get(`${origin}/api/employees`)).status(), 403);
  assert.equal((await page.request.get(`${origin}/api/customers/e2e_other_customer`)).status(), 404);
  assert.equal((await page.request.post(`${origin}/api/customers`, { headers: { Origin: origin }, data: { name: 'Forbidden demo mutation' } })).status(), 403);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
  assert.equal((await page.request.get(`${origin}/api/auth/me`)).status(), 401);
  console.log('Local HTTPS browser demo passed: passwordless employee login, Secure cookie sent by Chromium, real module data/PDF, denied admin/write/cross-tenant access and logout. Public URL/certificate verification is pending provider deployment.');
} finally {
  if (browser) await browser.close();
  proxy.closeAllConnections();
  await new Promise(resolve => proxy.close(resolve));
  for (const child of children) if (child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const fallback = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(fallback);
  }
  await prisma.$disconnect();
}

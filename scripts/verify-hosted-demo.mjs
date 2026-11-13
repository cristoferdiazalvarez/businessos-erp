import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';

// Explicit URLs only: no developer .env, database credentials or TLS bypass.
const origin = new URL(process.argv[2] ?? '');
const api = new URL(process.argv[3] ?? '');
for (const url of [origin, api]) {
  assert.equal(url.protocol, 'https:');
  assert(url.hostname.endsWith('.vercel.app'), 'Only the approved demo hosting is supported');
  assert(!url.username && !url.password && url.pathname === '/' && !url.search);
}
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium, expect } = webRequire('@playwright/test');
for (const url of [origin, new URL('/api/health', origin), new URL('/api/health', api)]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `Public trusted HTTPS: ${url}`);
}
mkdirSync(new URL('../docs/screenshots/', import.meta.url), { recursive: true });
const browser = await chromium.launch();
try {
  for (const [label, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    await page.goto(new URL('/login', origin).href);
    await page.getByRole('button', { name: 'Explore demo' }).click();
    await page.waitForURL(new URL('/app', origin).href);
    await page.getByRole('heading', { name: /Good morning/ }).waitFor();
    const cookie = (await context.cookies()).find(c => c.name === 'businessos_session');
    assert(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
    const me = await context.request.get(new URL('/api/auth/me', origin).href);
    assert.equal((await me.json()).user.role, 'EMPLOYEE');
    assert.equal((await context.request.get(new URL('/api/dashboard/summary', origin).href)).status(), 200);
    for (const section of ['customers', 'products', 'orders', 'invoices']) {
      await page.goto(new URL(`/app/${section}`, origin).href);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0);
      const response = await context.request.get(new URL(`/api/${section}`, origin).href);
      assert.equal(response.status(), 200);
      const data = await response.json();
      assert(data.items.length > 0, `${section} has seeded real records`);
      if (section === 'products') {
        assert(Number.isInteger(data.items[0].stock), 'Persisted inventory quantity');
        assert.equal((await context.request.get(new URL(`/api/products/${data.items[0].id}/movements`, origin).href)).status(), 200);
      }
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download invoice/ }).first().click();
    assert.equal(readFileSync(await (await download).path()).subarray(0, 5).toString(), '%PDF-');
    for (const [path, status] of [['employees', 403], ['customers/e2e_other_customer', 404]]) {
      assert.equal((await context.request.get(new URL(`/api/${path}`, origin).href)).status(), status);
    }
    assert.equal((await context.request.post(new URL('/api/customers', origin).href, { headers: { Origin: origin.origin }, data: { name: 'Forbidden demo mutation' } })).status(), 403);
    await page.goto(new URL('/app', origin).href);
    await page.getByRole('heading', { name: /Good morning/ }).waitFor();
    // Let the real chart's entrance animation finish before publishing captures.
    await page.locator('.recharts-area-curve').waitFor({ state: 'attached' });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: new URL(`../docs/screenshots/hosted-demo-${label}.png`, import.meta.url).pathname, fullPage: true });
    if (label === 'mobile') await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/login/);
    assert.equal((await context.request.get(new URL('/api/auth/me', origin).href)).status(), 401);
    await context.close();
    console.log(`Hosted ${label}: trusted HTTPS, employee session, real modules/PDF, tenant/role/write restrictions and logout passed`);
  }
} finally {
  await browser.close();
}

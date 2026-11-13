import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

test('desktop/mobile public pages, authenticated modules, cookies and manager permissions', async ({ page, context }) => {
  test.setTimeout(180_000);
  const directory = resolve(process.cwd(), '../../docs/screenshots');
  await mkdir(directory, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const [route, file] of [['/', 'landing'], ['/login', 'login']]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await page.screenshot({ path: `${directory}/${file}-${name}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
  }
  await page.getByLabel('Work email').fill(process.env.DEMO_ADMIN_EMAIL ?? 'admin@businessos.demo');
  await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const cookie = (await context.cookies()).find(cookie => cookie.name === 'businessos_session')!;
  expect(cookie.httpOnly).toBeTruthy();
  expect(cookie.sameSite).toBe('Lax');
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const section of ['', 'customers', 'products', 'orders', 'invoices', 'reports', 'team', 'settings', 'audit']) {
      await page.goto(`/app${section ? `/${section}` : ''}`);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0);
      await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
      if (section === '' || section === 'reports') {
        await expect(page.locator('.recharts-area')).toBeVisible();
        // Recharts uses a 1.5-second JavaScript mount animation, independent of CSS.
        await page.waitForTimeout(1700);
      }
      await page.screenshot({ path: `${directory}/${section || 'dashboard'}-${name}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), section).toBeTruthy();
    }
  }
  // API logout must revoke the server-side token even if it is replayed manually.
  await page.request.post('http://localhost:4000/api/auth/logout', { headers: { Origin: 'http://localhost:3000' } });
  expect((await page.request.get('http://localhost:4000/api/auth/me', { headers: { Cookie: `businessos_session=${cookie.value}` } })).status()).toBe(401);
  const manager = await page.request.post('http://localhost:4000/api/auth/login', {
    headers: { Origin: 'http://localhost:3000' },
    data: { email: process.env.DEMO_MANAGER_EMAIL ?? 'manager@businessos.demo', password: process.env.DEMO_MANAGER_PASSWORD },
  });
  expect(manager.status()).toBe(200);
  const members = await (await page.request.get('http://localhost:4000/api/employees')).json();
  expect((await page.request.patch(`http://localhost:4000/api/employees/${members[0].id}/role`, { headers: { Origin: 'http://localhost:3000' }, data: { role: 'ADMIN' } })).status()).toBe(403);
  expect((await page.request.get('http://localhost:4000/api/products')).status()).toBe(200);
  expect(errors).toEqual([]);
});

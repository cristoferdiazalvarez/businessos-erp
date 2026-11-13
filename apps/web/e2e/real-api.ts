import { expect, type APIRequestContext } from '@playwright/test';

const base = 'http://localhost:4000/api';
const headers = { Origin: 'http://localhost:3000' };

export async function verifyAdminApi(request: APIRequestContext) {
  expect((await request.post(`${base}/customers`, { headers, data: { name: '' } })).status()).toBe(400);
  expect((await request.post(`${base}/customers`, { headers: { Origin: 'https://untrusted.example' }, data: { name: 'Rejected' } })).status()).toBe(403);
  const suffix = Date.now().toString(36);
  const customerResponse = await request.post(`${base}/customers`, { headers, data: { name: `API QA ${suffix}`, email: `api.${suffix}@example.test`, tags: [] } });
  expect(customerResponse.status()).toBe(201);
  const customer = await customerResponse.json();
  expect((await request.patch(`${base}/customers/${customer.id}`, { headers, data: { company: 'QA Studio' } })).ok()).toBeTruthy();
  const productResponse = await request.post(`${base}/products`, { headers, data: { sku: `API-${suffix}`, name: `API product ${suffix}`, price: '10.00', stock: 2, lowStockAt: 1 } });
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json();
  const input = { customerId: customer.id, discount: '0', items: [{ productId: product.id, quantity: 2 }] };
  // Race real transactions for the last two units; exactly one must reserve them.
  const results = await Promise.all([request.post(`${base}/orders`, { headers, data: input }), request.post(`${base}/orders`, { headers, data: input })]);
  expect(results.map(result => result.status()).sort()).toEqual([201, 409]);
  const order = await results.find(result => result.status() === 201)!.json();
  expect(Number(order.total)).toBe(21.65);
  const movements = await request.get(`${base}/products/${product.id}/movements`);
  expect((await movements.json()).reduce((sum: number, entry: { quantity: number }) => sum + entry.quantity, 0)).toBe(0);
  expect((await request.patch(`${base}/orders/${order.id}/status`, { headers, data: { status: 'CANCELLED' } })).ok()).toBeTruthy();
  expect((await request.patch(`${base}/orders/${order.id}/status`, { headers, data: { status: 'CANCELLED' } })).status()).toBe(409);
  const afterCancel = await request.get(`${base}/products/${product.id}/movements`);
  expect((await afterCancel.json()).reduce((sum: number, entry: { quantity: number }) => sum + entry.quantity, 0)).toBe(2);
  const me = await request.get(`${base}/auth/me`);
  expect((await me.json()).user.role).toBe('ADMIN');
  return { customer: customer.id as string, product: product.id as string, order: order.id as string, invoice: order.invoice.id as string };
}

export async function verifyForeignTenant(request: APIRequestContext, ids: Awaited<ReturnType<typeof verifyAdminApi>>) {
  for (const path of [`customers/${ids.customer}`, `products/${ids.product}/movements`, `orders/${ids.order}`, `invoices/${ids.invoice}/pdf`]) {
    expect((await request.get(`${base}/${path}`)).status(), path).toBe(404);
  }
  expect((await request.patch(`${base}/customers/${ids.customer}`, { headers, data: { name: 'Tenant bypass' } })).status()).toBe(404);
  expect((await request.post(`${base}/products/${ids.product}/stock`, { headers, data: { quantity: 1, reason: 'Tenant bypass' } })).status()).toBe(404);
  expect((await request.post(`${base}/orders`, { headers, data: { customerId: ids.customer, discount: '0', items: [{ productId: ids.product, quantity: 1 }] } })).status()).toBe(404);
}

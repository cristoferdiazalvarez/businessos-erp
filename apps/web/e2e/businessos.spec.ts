import { expect, test } from "@playwright/test";
import { verifyAdminApi, verifyForeignTenant } from "./real-api";
import { readFile } from "node:fs/promises";

const adminEmail = process.env.DEMO_ADMIN_EMAIL ?? "admin@businessos.demo";
const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
const employeeEmail = process.env.DEMO_EMPLOYEE_EMAIL ?? "employee@businessos.demo";
const employeePassword = process.env.DEMO_EMPLOYEE_PASSWORD;
const isolatedEmail = process.env.E2E_OTHER_EMAIL ?? "isolation@businessos.demo";
const isolatedPassword = process.env.E2E_OTHER_PASSWORD;

test("critical workspace, role, order, invoice, export and tenant-isolation flows", async ({ page }) => {
  expect(adminPassword, "Set DEMO_ADMIN_PASSWORD and run the reproducible seed first").toBeTruthy();
  expect(employeePassword, "Set DEMO_EMPLOYEE_PASSWORD and run the reproducible seed first").toBeTruthy();
  expect(isolatedPassword, "Set E2E_OTHER_PASSWORD and run the isolation seed first").toBeTruthy();
  const disabledDemo = await page.request.post("http://localhost:4000/api/auth/demo", {
    headers: { Origin: "http://localhost:3000" },
  });
  expect(disabledDemo.status()).toBe(403);

  const suffix = Date.now().toString(36);
  const customerName = `E2E Customer ${suffix}`;
  const productName = `E2E Desk Lamp ${suffix}`;
  const sku = `E2E-${suffix}`;
  await page.goto("/login");
  await page.getByLabel("Work email").fill(adminEmail);
  await page.getByLabel("Password", { exact: true }).fill(adminPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
  await expect(page.getByText("Revenue over time")).toBeVisible();

  const resources = await verifyAdminApi(page.request);

  await page.getByRole("link", { name: "Customers" }).click();
  await page.getByRole("button", { name: "Add customer" }).click();
  await page.getByLabel("Full name").fill(customerName);
  await page.getByLabel("Email").fill(`e2e.${suffix}@example.test`);
  await page.getByLabel("Company").fill("Fictional E2E Co.");
  await page.getByLabel(/Tags/).fill("QA, Portfolio");
  await page.getByRole("button", { name: "Create customer" }).click();
  await expect(page.getByRole("button", { name: "Create customer" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search customers" }).fill(customerName);
  await expect(page.getByText(customerName)).toBeVisible();

  await page.getByRole("link", { name: "Products & stock" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Product name").fill(productName);
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel(/Price/).fill("35.50");
  await page.getByLabel("Low-stock alert at").fill("2");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("button", { name: "Create product" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search products" }).fill(sku);
  await expect(page.getByText(productName)).toBeVisible();
  const productRow = page.getByRole("row").filter({ hasText: sku });
  await productRow.getByRole("button", { name: "Adjust stock" }).click();
  await page.getByLabel("Quantity change").fill("5");
  await page.getByLabel("Reason").fill("E2E opening stock");
  await page.getByRole("button", { name: "Save adjustment" }).click();
  await expect(productRow).toContainText("5");

  await page.getByRole("link", { name: "Sales" }).click();
  await page.getByRole("button", { name: "Create order" }).click();
  const customerOption = page.getByLabel("Customer").locator("option").filter({ hasText: customerName }).first();
  await page.getByLabel("Customer").selectOption((await customerOption.getAttribute("value")) ?? "");
  const productOption = page.getByLabel("Product 1").locator("option").filter({ hasText: productName }).first();
  await page.getByLabel("Product 1").selectOption((await productOption.getAttribute("value")) ?? "");
  await page.getByRole("button", { name: "Create order" }).last().click();
  const orderRow = page.getByRole("row").filter({ hasText: customerName });
  await expect(orderRow).toContainText("confirmed");
  page.once("dialog", (dialog) => dialog.accept());
  await orderRow.getByRole("button", { name: "Mark paid" }).click();
  await expect(orderRow).toContainText("paid");

  await page.getByRole("link", { name: "Invoices" }).click();
  const invoiceRow = page.getByRole("row").filter({ hasText: customerName });
  await expect(invoiceRow).toBeVisible();
  const downloadWait = page.waitForEvent("download");
  await invoiceRow.getByRole("button", { name: /Download invoice/ }).click();
  const download = await downloadWait;
  expect(download.suggestedFilename()).toMatch(/^INV-.*\.pdf$/);
  const pdf = await readFile(await download.path());
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

  await page.getByRole("link", { name: "Reports" }).click();
  const csvWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Sales CSV" }).click();
  const csvDownload = await csvWait;
  const csvPath = await csvDownload.path();
  expect((await readFile(csvPath, "utf8")).split(/\r?\n/)[0]).toBe('"Order","Date","Customer","Status","Subtotal","Discount","Tax","Total"');

  await page.getByRole("link", { name: "Activity log" }).click();
  await expect(page.getByText("inventory adjusted").first()).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(employeeEmail);
  await page.getByLabel("Password", { exact: true }).fill(employeePassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page.getByRole("button", { name: "Add customer" })).toHaveCount(0);
  const forbidden = await page.request.post("http://localhost:4000/api/customers", {
    data: { name: "Role bypass", tags: [] },
    headers: { Origin: "http://localhost:3000" },
  });
  expect(forbidden.status()).toBe(403);
  const crossTenantRecord = await page.request.get("http://localhost:4000/api/customers/e2e_other_customer");
  expect(crossTenantRecord.status()).toBe(404);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(isolatedEmail);
  await page.getByLabel("Password", { exact: true }).fill(isolatedPassword!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  const ownTenantRecord = await page.request.get("http://localhost:4000/api/customers/e2e_other_customer");
  expect(ownTenantRecord.status()).toBe(200);
  await verifyForeignTenant(page.request, resources);
  await expect(page.getByRole("heading", { name: /Good morning/ })).toBeVisible();
});

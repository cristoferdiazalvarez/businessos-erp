import { PrismaClient, type OrderStatus } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();
const demoOrg = { slug: "northstar-studio", name: "Northstar Studio" };

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 12) {
    throw new Error(`${name} must be set to a unique password of at least 12 characters before seeding.`);
  }
  return value;
}

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { slug: demoOrg.slug },
    update: { name: demoOrg.name, currency: "USD", taxRate: "0.0825" },
    create: { ...demoOrg, currency: "USD", taxRate: "0.0825" },
  });

  const demoUsers = [
    { email: process.env.DEMO_ADMIN_EMAIL ?? "admin@businessos.demo", name: "Alex Morgan", role: "ADMIN" as const, key: "DEMO_ADMIN_PASSWORD" },
    { email: process.env.DEMO_MANAGER_EMAIL ?? "manager@businessos.demo", name: "Jordan Lee", role: "MANAGER" as const, key: "DEMO_MANAGER_PASSWORD" },
    { email: process.env.DEMO_EMPLOYEE_EMAIL ?? "employee@businessos.demo", name: "Taylor Reed", role: "EMPLOYEE" as const, key: "DEMO_EMPLOYEE_PASSWORD" },
  ];

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email.toLowerCase() },
      update: {
        name: demoUser.name,
        passwordHash: await argon2.hash(required(demoUser.key), { type: argon2.argon2id }),
      },
      create: {
        email: demoUser.email.toLowerCase(),
        name: demoUser.name,
        passwordHash: await argon2.hash(required(demoUser.key), { type: argon2.argon2id }),
      },
    });
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: { role: demoUser.role },
      create: { userId: user.id, organizationId: organization.id, role: demoUser.role },
    });
  }

  const categoryNames = ["Design", "Workspace", "Accessories"];
  const categories = new Map<string, string>();
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: {},
      create: { organizationId: organization.id, name },
    });
    categories.set(name, category.id);
  }

  const productSpecs = [
    { sku: "DSK-101", name: "Studio Desk", category: "Workspace", price: "549.00", stock: 18, lowStockAt: 5 },
    { sku: "CHR-204", name: "Ergonomic Chair", category: "Workspace", price: "389.00", stock: 12, lowStockAt: 5 },
    { sku: "LMP-032", name: "Arc Task Lamp", category: "Design", price: "129.00", stock: 4, lowStockAt: 6 },
    { sku: "ORG-110", name: "Desk Organizer", category: "Accessories", price: "48.00", stock: 32, lowStockAt: 8 },
    { sku: "MAT-088", name: "Felt Desk Mat", category: "Accessories", price: "72.00", stock: 24, lowStockAt: 8 },
  ];
  const products = new Map<string, { id: string; price: number }>();
  for (const product of productSpecs) {
    const row = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId: organization.id, sku: product.sku } },
      update: {
        name: product.name,
        categoryId: categories.get(product.category),
        price: product.price,
        stock: product.stock,
        lowStockAt: product.lowStockAt,
        active: true,
      },
      create: {
        organizationId: organization.id,
        sku: product.sku,
        name: product.name,
        categoryId: categories.get(product.category),
        price: product.price,
        stock: product.stock,
        lowStockAt: product.lowStockAt,
      },
    });
    products.set(product.sku, { id: row.id, price: Number(product.price) });
  }

  const customerSpecs = [
    { name: "Olivia Chen", email: "olivia.chen@example.test", company: "Fieldwork Co.", tags: ["Design", "Wholesale"] },
    { name: "Marcus Williams", email: "marcus.w@example.test", company: "Common Ground", tags: ["Retail"] },
    { name: "Priya Patel", email: "priya.p@example.test", company: "Forma Studio", tags: ["Design"] },
    { name: "Noah Garcia", email: "noah.g@example.test", company: "Daylight Office", tags: ["Wholesale"] },
    { name: "Ava Thompson", email: "ava.t@example.test", company: "Atelier North", tags: ["Retail", "Design"] },
  ];
  const customers = new Map<string, string>();
  for (const customer of customerSpecs) {
    const row = await prisma.customer.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: customer.email } },
      update: { name: customer.name, company: customer.company, tags: customer.tags },
      create: { organizationId: organization.id, ...customer },
    });
    customers.set(customer.email, row.id);
  }

  const orders: Array<{
    number: string;
    customerEmail: string;
    ageDays: number;
    status: OrderStatus;
    discount: number;
    items: Array<{ sku: string; quantity: number }>;
  }> = [
    { number: "SO-2026-001", customerEmail: "olivia.chen@example.test", ageDays: 2, status: "PAID", discount: 0, items: [{ sku: "DSK-101", quantity: 1 }, { sku: "ORG-110", quantity: 2 }] },
    { number: "SO-2026-002", customerEmail: "marcus.w@example.test", ageDays: 5, status: "PAID", discount: 25, items: [{ sku: "CHR-204", quantity: 2 }] },
    { number: "SO-2026-003", customerEmail: "priya.p@example.test", ageDays: 11, status: "CONFIRMED", discount: 0, items: [{ sku: "LMP-032", quantity: 2 }, { sku: "MAT-088", quantity: 1 }] },
    { number: "SO-2026-004", customerEmail: "noah.g@example.test", ageDays: 20, status: "PAID", discount: 12, items: [{ sku: "ORG-110", quantity: 3 }, { sku: "MAT-088", quantity: 2 }] },
    { number: "SO-2026-005", customerEmail: "ava.t@example.test", ageDays: 27, status: "PAID", discount: 0, items: [{ sku: "DSK-101", quantity: 1 }, { sku: "CHR-204", quantity: 1 }] },
  ];

  const unitsSold = new Map<string, number>();
  for (const order of orders) {
    for (const item of order.items) {
      unitsSold.set(item.sku, (unitsSold.get(item.sku) ?? 0) + item.quantity);
    }
  }

  for (const order of orders) {
    const createdAt = new Date();
    createdAt.setUTCDate(createdAt.getUTCDate() - order.ageDays);
    const subtotal = order.items.reduce(
      (sum, item) => sum + (products.get(item.sku)?.price ?? 0) * item.quantity,
      0,
    );
    const taxRate = 0.0825;
    const taxAmount = Number(((subtotal - order.discount) * taxRate).toFixed(2));
    const total = Number((subtotal - order.discount + taxAmount).toFixed(2));
    const orderRow = await prisma.order.upsert({
      where: { organizationId_orderNumber: { organizationId: organization.id, orderNumber: order.number } },
      update: {
        customerId: customers.get(order.customerEmail)!,
        status: order.status,
        subtotal: subtotal.toFixed(2),
        discount: order.discount.toFixed(2),
        taxRate: taxRate.toFixed(4),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        createdAt,
      },
      create: {
        organizationId: organization.id,
        customerId: customers.get(order.customerEmail)!,
        orderNumber: order.number,
        status: order.status,
        subtotal: subtotal.toFixed(2),
        discount: order.discount.toFixed(2),
        taxRate: taxRate.toFixed(4),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        createdAt,
        items: {
          create: order.items.map((item) => {
            const product = products.get(item.sku)!;
            const lineTotal = product.price * item.quantity;
            return {
              productId: product.id,
              quantity: item.quantity,
              unitPrice: product.price.toFixed(2),
              lineTotal: lineTotal.toFixed(2),
            };
          }),
        },
      },
      include: { items: true },
    });

    for (const item of orderRow.items) {
      const product = productSpecs.find((entry) => products.get(entry.sku)?.id === item.productId);
      if (!product) throw new Error(`Unknown seeded product for order ${order.number}.`);
      await prisma.inventoryMovement.upsert({
        where: { sourceKey: `seed:sale:${order.number}:${product.sku}` },
        update: { quantity: -item.quantity },
        create: {
          organizationId: organization.id,
          productId: item.productId,
          quantity: -item.quantity,
          reason: `Demo sale ${order.number}`,
          sourceKey: `seed:sale:${order.number}:${product.sku}`,
        },
      });
    }

    await prisma.invoice.upsert({
      where: { orderId: orderRow.id },
      update: { number: `INV-${order.number.slice(3)}`, status: "ISSUED" },
      create: {
        organizationId: organization.id,
        orderId: orderRow.id,
        number: `INV-${order.number.slice(3)}`,
        status: "ISSUED",
        issuedAt: createdAt,
      },
    });
  }

  for (const product of productSpecs) {
    const initialStock = product.stock + (unitsSold.get(product.sku) ?? 0);
    await prisma.inventoryMovement.upsert({
      where: { sourceKey: `seed:opening:${product.sku}` },
      update: { quantity: initialStock },
      create: {
        organizationId: organization.id,
        productId: products.get(product.sku)!.id,
        quantity: initialStock,
        reason: "Demo opening balance",
        sourceKey: `seed:opening:${product.sku}`,
      },
    });
  }

  console.log("Seeded Northstar Studio demo organization and data.");
}

main()
  .catch((error: unknown) => {
    console.error("BusinessOS seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

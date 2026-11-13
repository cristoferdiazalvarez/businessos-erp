import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { OrdersService } from "./orders.service";
import type { PrismaService } from "../prisma/prisma.service";

describe("OrdersService", () => {
  function makeTransaction(stockChangeCount = 1) {
    const tx = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          currency: "USD",
          taxRate: new Prisma.Decimal("0.0825"),
        }),
      },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: "customer_1" }) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "product_1",
            name: "Desk",
            price: new Prisma.Decimal("100.00"),
            stock: 5,
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: stockChangeCount }),
      },
      order: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "order_1",
            orderNumber: data.orderNumber,
            total: data.total,
            customer: { id: "customer_1", name: "Demo Buyer" },
            items: [],
          }),
        ),
      },
      inventoryMovement: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      invoice: { create: jest.fn().mockResolvedValue({ id: "invoice_1" }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit_1" }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    return { tx, prisma, service: new OrdersService(prisma as unknown as PrismaService) };
  }

  it("calculates totals on the server and commits order, invoice, stock and audit together", async () => {
    const { tx, service } = makeTransaction();

    const order = await service.create("org_1", "user_1", {
      customerId: "customer_1",
      discount: "10.00",
      taxRate: 0.1,
      items: [{ productId: "product_1", quantity: 1 }],
    });

    const created = tx.order.create.mock.calls[0][0].data;
    expect(created.subtotal.toString()).toBe("100");
    expect(created.discount.toString()).toBe("10");
    expect(created.taxAmount.toString()).toBe("9");
    expect(created.total.toString()).toBe("99");
    expect(created.items.create[0]).toMatchObject({
      productId: "product_1",
      quantity: 1,
      lineTotal: new Prisma.Decimal("100"),
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "product_1", organizationId: "org_1", active: true, stock: { gte: 1 } },
      data: { stock: { decrement: 1 } },
    });
    expect(tx.inventoryMovement.createMany).toHaveBeenCalledWith({
      data: [{ organizationId: "org_1", productId: "product_1", quantity: -1, reason: expect.stringMatching(/^Sale SO-/) }],
    });
    expect(tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org_1", orderId: "order_1", status: "ISSUED" }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org_1", actorId: "user_1", action: "order.created" }),
    }));
    expect(order.invoice).toMatchObject({ id: "invoice_1" });
    expect(tx.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org_1", active: true }),
    }));
  });

  it("rejects insufficient stock before invoice and order records can be committed", async () => {
    const { tx, service } = makeTransaction(0);

    await expect(service.create("org_1", "user_1", {
      customerId: "customer_1",
      discount: "0.00",
      items: [{ productId: "product_1", quantity: 6 }],
    })).rejects.toBeInstanceOf(ConflictException);

    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

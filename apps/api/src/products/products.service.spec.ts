import { ConflictException, NotFoundException } from "@nestjs/common";
import { ProductsService } from "./products.service";
import type { PrismaService } from "../prisma/prisma.service";

describe("ProductsService inventory adjustments", () => {
  function makeTransaction(overrides?: {
    updateCount?: number;
    existing?: { id: string; stock: number } | null;
  }) {
    const tx = {
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: overrides?.updateCount ?? 1 }),
        findFirst: jest.fn().mockResolvedValue(
          overrides && "existing" in overrides ? overrides.existing : { id: "p_1", stock: 5 },
        ),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: "p_1", stock: 3 }),
      },
      inventoryMovement: { create: jest.fn().mockResolvedValue({ id: "move_1" }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit_1" }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    return { tx, prisma, service: new ProductsService(prisma as unknown as PrismaService) };
  }

  it("atomically applies a tenant-scoped quantity change and writes movement/audit records", async () => {
    const { tx, prisma, service } = makeTransaction();

    await service.adjustStock("org_1", "user_1", "p_1", -2, "Damaged in transit");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: "p_1", organizationId: "org_1", active: true, stock: { gte: 2 } },
      data: { stock: { increment: -2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: { organizationId: "org_1", productId: "p_1", quantity: -2, reason: "Damaged in transit" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: "org_1", actorId: "user_1", action: "inventory.adjusted" }),
    }));
  });

  it("rejects adjustments that would take stock below zero without writing history", async () => {
    const { tx, service } = makeTransaction({ updateCount: 0, existing: { id: "p_1", stock: 1 } });

    await expect(service.adjustStock("org_1", "user_1", "p_1", -2, "Damaged")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("does not distinguish another tenant's product from a missing product", async () => {
    const { tx, service } = makeTransaction({ updateCount: 0, existing: null });

    await expect(service.adjustStock("org_1", "user_1", "p_other", 5, "Restock")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.product.findFirst).toHaveBeenCalledWith({
      where: { id: "p_other", organizationId: "org_1", active: true },
    });
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});

describe("ProductsService category management", () => {
  it("creates a category in the active organization and records an audit event", async () => {
    const tx = {
      category: { create: jest.fn().mockResolvedValue({ id: "cat_1", name: "Accessories" }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit_1" }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await service.createCategory("org_1", "user_1", "Accessories");

    expect(tx.category.create).toHaveBeenCalledWith({
      data: { organizationId: "org_1", name: "Accessories" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: "org_1", actorId: "user_1", action: "category.created" }),
    });
  });

  it("does not reveal or audit a category belonging to another organization", async () => {
    const tx = {
      category: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.removeCategory("org_1", "user_1", "cat_other")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.category.deleteMany).toHaveBeenCalledWith({
      where: { id: "cat_other", organizationId: "org_1" },
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

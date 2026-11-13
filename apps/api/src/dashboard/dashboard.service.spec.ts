import { DashboardService } from "./dashboard.service";
import type { PrismaService } from "../prisma/prisma.service";

describe("DashboardService", () => {
  it("calculates metrics from persisted records scoped to the supplied organization", async () => {
    const now = new Date();
    const orderTotal = { toNumber: () => 125 };
    const revenueOrders = [{ createdAt: now, total: orderTotal }];
    const recentOrders = [{
      id: "order_1",
      orderNumber: "SO-1",
      status: "PAID",
      total: orderTotal,
      createdAt: now,
      customer: { name: "Fictional Customer" },
    }];
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ currency: "CAD" }) },
      order: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: orderTotal } }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn(({ select }: { select?: unknown; where: Record<string, unknown> }) =>
          Promise.resolve(select ? revenueOrders : recentOrders),
        ),
      },
      customer: { count: jest.fn().mockResolvedValue(4) },
      product: { count: jest.fn().mockResolvedValue(5) },
      $queryRaw: jest.fn().mockResolvedValue([{ count: 2n }]),
    };
    const service = new DashboardService(prisma as unknown as PrismaService);

    const result = await service.summary("org_1", 7);

    expect(result.currency).toBe("CAD");
    expect(result.periodDays).toBe(7);
    expect(result.kpis).toEqual({ revenue: 125, orders: 1, customers: 4, products: 5, lowStock: 2 });
    expect(result.revenueSeries).toHaveLength(7);
    expect(result.revenueSeries.at(-1)?.revenue).toBe(125);
    expect(result.recentOrders[0]?.customer).toBe("Fictional Customer");
    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: "org_1" }) }),
    );
    expect(prisma.customer.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org_1" } }),
    );
    expect(prisma.product.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org_1", active: true } }),
    );
    expect(prisma.$queryRaw.mock.calls[0][1]).toBe("org_1");
    expect(prisma.order.findMany).toHaveBeenCalledTimes(2);
    for (const [arguments_] of prisma.order.findMany.mock.calls) {
      expect(arguments_.where.organizationId).toBe("org_1");
    }
  });
});

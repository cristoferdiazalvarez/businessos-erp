import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

function asNumber(value: Prisma.Decimal | null | undefined): number {
  return value?.toNumber() ?? 0;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, requestedDays?: number) {
    const days = Math.min(Math.max(requestedDays ?? 30, 7), 90);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const [organization, revenue, orderCount, customerCount, productCount, lowStockRows, orders] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { currency: true },
        }),
        this.prisma.order.aggregate({
          where: {
            organizationId,
            createdAt: { gte: start },
            status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED] },
          },
          _sum: { total: true },
        }),
        this.prisma.order.count({
          where: { organizationId, createdAt: { gte: start } },
        }),
        this.prisma.customer.count({ where: { organizationId } }),
        this.prisma.product.count({ where: { organizationId, active: true } }),
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count
          FROM "Product"
          WHERE "organizationId" = ${organizationId}
            AND active = true
            AND stock <= "lowStockAt"
        `,
        this.prisma.order.findMany({
          where: {
            organizationId,
            createdAt: { gte: start },
            status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED] },
          },
          select: { createdAt: true, total: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);
    if (!organization) throw new NotFoundException("Organization not found");

    const series = Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, revenue: 0 };
    });
    const byDate = new Map(series.map((point) => [point.date, point]));
    for (const order of orders) {
      const point = byDate.get(order.createdAt.toISOString().slice(0, 10));
      if (point) point.revenue += asNumber(order.total);
    }

    const recentOrders = await this.prisma.order.findMany({
      where: { organizationId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return {
      periodDays: days,
      currency: organization.currency,
      kpis: {
        revenue: asNumber(revenue._sum.total),
        orders: orderCount,
        customers: customerCount,
        products: productCount,
        lowStock: Number(lowStockRows[0]?.count ?? 0),
      },
      revenueSeries: series,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer.name,
        status: order.status,
        total: asNumber(order.total),
        createdAt: order.createdAt,
      })),
    };
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ReportType = "sales" | "products" | "customers";

interface DateRange {
  from?: string;
  to?: string;
}

function csvCell(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function csv(rows: Array<Array<string | number | null>>): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  resolveRange(range: DateRange) {
    const to = range.to ? new Date(`${range.to}T00:00:00.000Z`) : new Date();
    to.setUTCHours(0, 0, 0, 0);
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const from = range.from ? new Date(`${range.from}T00:00:00.000Z`) : new Date(to);
    if (!range.from) from.setUTCDate(from.getUTCDate() - 29);
    from.setUTCHours(0, 0, 0, 0);
    if (from > to) throw new BadRequestException("Report start date must not be after end date");
    const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days > 366) throw new BadRequestException("Report date range cannot exceed 366 days");
    if (to > new Date(new Date().toISOString().slice(0, 10))) {
      throw new BadRequestException("Report end date cannot be in the future");
    }
    return { from, toExclusive, days };
  }

  async summary(organizationId: string, range: DateRange) {
    const { from, toExclusive, days } = this.resolveRange(range);
    const where: Prisma.OrderWhereInput = {
      organizationId,
      createdAt: { gte: from, lt: toExclusive },
      status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED] },
    };
    const [organization, revenue, orders, seriesRows, productGroups, customerGroups] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { currency: true },
        }),
        this.prisma.order.aggregate({ where, _sum: { total: true } }),
        this.prisma.order.count({ where }),
        this.prisma.$queryRaw<Array<{ date: Date; revenue: Prisma.Decimal }>>`
          SELECT DATE_TRUNC('day', "createdAt")::date AS date, SUM(total) AS revenue
          FROM "Order"
          WHERE "organizationId" = ${organizationId}
            AND "createdAt" >= ${from}
            AND "createdAt" < ${toExclusive}
            AND status IN ('PAID', 'CONFIRMED')
          GROUP BY DATE_TRUNC('day', "createdAt")::date
          ORDER BY date
        `,
        this.prisma.orderItem.groupBy({
          by: ["productId"],
          where: {
            order: {
              organizationId,
              createdAt: { gte: from, lt: toExclusive },
              status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED] },
            },
          },
          _sum: { quantity: true, lineTotal: true },
          orderBy: { _sum: { lineTotal: "desc" } },
          take: 10,
        }),
        this.prisma.order.groupBy({
          by: ["customerId"],
          where,
          _sum: { total: true },
          _count: { id: true },
          orderBy: { _sum: { total: "desc" } },
          take: 10,
        }),
      ]);
    if (!organization) throw new NotFoundException("Organization not found");

    const productIds = productGroups.map(({ productId }) => productId);
    const customerIds = customerGroups.map(({ customerId }) => customerId);
    const [products, customers] = await Promise.all([
      productIds.length
        ? this.prisma.product.findMany({
            where: { organizationId, id: { in: productIds } },
            select: { id: true, sku: true, name: true },
          })
        : [],
      customerIds.length
        ? this.prisma.customer.findMany({
            where: { organizationId, id: { in: customerIds } },
            select: { id: true, name: true, company: true },
          })
        : [],
    ]);

    const productById = new Map(products.map((product) => [product.id, product]));
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const daily = new Map(seriesRows.map((row) => [
      row.date.toISOString().slice(0, 10),
      row.revenue.toNumber(),
    ]));
    const revenueSeries = Array.from({ length: days }, (_, index) => {
      const date = new Date(from);
      date.setUTCDate(from.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, revenue: daily.get(key) ?? 0 };
    });

    return {
      from: from.toISOString().slice(0, 10),
      to: new Date(toExclusive.getTime() - 1).toISOString().slice(0, 10),
      currency: organization.currency,
      revenue: revenue._sum.total?.toNumber() ?? 0,
      orders,
      revenueSeries,
      topProducts: productGroups.map((group) => ({
        ...productById.get(group.productId),
        quantity: group._sum.quantity ?? 0,
        revenue: group._sum.lineTotal?.toNumber() ?? 0,
      })),
      topCustomers: customerGroups.map((group) => ({
        ...customerById.get(group.customerId),
        orders: group._count.id,
        revenue: group._sum.total?.toNumber() ?? 0,
      })),
    };
  }

  async exportCsv(organizationId: string, type: ReportType, range: DateRange): Promise<string> {
    const { from, toExclusive } = this.resolveRange(range);
    if (type === "sales") {
      const orders = await this.prisma.order.findMany({
        where: { organizationId, createdAt: { gte: from, lt: toExclusive } },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return csv([
        ["Order", "Date", "Customer", "Status", "Subtotal", "Discount", "Tax", "Total"],
        ...orders.map((order) => [
          order.orderNumber,
          order.createdAt.toISOString().slice(0, 10),
          order.customer.name,
          order.status,
          order.subtotal.toFixed(2),
          order.discount.toFixed(2),
          order.taxAmount.toFixed(2),
          order.total.toFixed(2),
        ]),
      ]);
    }
    if (type === "products") {
      const groups = await this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            organizationId,
            createdAt: { gte: from, lt: toExclusive },
            status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED] },
          },
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
      });
      const products = groups.length
        ? await this.prisma.product.findMany({
            where: { organizationId, id: { in: groups.map((group) => group.productId) } },
            select: { id: true, sku: true, name: true },
          })
        : [];
      const productById = new Map(products.map((product) => [product.id, product]));
      return csv([
        ["SKU", "Product", "Units sold", "Sales"],
        ...groups.map((group) => [
          productById.get(group.productId)?.sku ?? "",
          productById.get(group.productId)?.name ?? "",
          group._sum.quantity ?? 0,
          group._sum.lineTotal?.toFixed(2) ?? "0.00",
        ]),
      ]);
    }
    if (type === "customers") {
      const customers = await this.prisma.customer.findMany({
        where: { organizationId },
        include: { _count: { select: { orders: { where: { createdAt: { gte: from, lt: toExclusive } } } } } },
        orderBy: { name: "asc" },
      });
      return csv([
        ["Name", "Company", "Email", "Phone", "Tags", "Orders in period"],
        ...customers.map((customer) => [
          customer.name,
          customer.company,
          customer.email,
          customer.phone,
          customer.tags.join("; "),
          customer._count.orders,
        ]),
      ]);
    }
    throw new BadRequestException("Unknown report type");
  }
}

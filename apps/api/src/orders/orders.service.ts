import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InvoiceStatus, OrderStatus, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

interface CreateOrderInput {
  customerId: string;
  discount: string;
  taxRate?: number;
  items: Array<{ productId: string; quantity: number }>;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, page: number, limit: number, status?: OrderStatus) {
    const where: Prisma.OrderWhereInput = { organizationId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, company: true } },
          invoice: { select: { id: true, number: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(organizationId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        customer: true,
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        invoice: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async create(organizationId: string, actorId: string, input: CreateOrderInput) {
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const [organization, customer, products] = await Promise.all([
          tx.organization.findUnique({
            where: { id: organizationId },
            select: { currency: true, taxRate: true },
          }),
          tx.customer.findFirst({ where: { id: input.customerId, organizationId } }),
          tx.product.findMany({
            where: { organizationId, active: true, id: { in: [...quantities.keys()] } },
          }),
        ]);
        if (!organization) throw new NotFoundException("Organization not found");
        if (!customer) throw new NotFoundException("Customer not found");
        if (products.length !== quantities.size) {
          throw new NotFoundException("One or more products are not available in this organization");
        }

        const productById = new Map(products.map((product) => [product.id, product]));
        let subtotal = new Prisma.Decimal(0);
        for (const [productId, quantity] of quantities) {
          const product = productById.get(productId);
          if (!product) throw new NotFoundException("Product not found");
          subtotal = subtotal.plus(product.price.mul(quantity));
        }
        const discount = new Prisma.Decimal(input.discount);
        if (discount.greaterThan(subtotal)) {
          throw new ConflictException("Discount cannot be greater than the order subtotal");
        }
        const taxRate = new Prisma.Decimal(input.taxRate ?? organization.taxRate);
        const taxAmount = subtotal.minus(discount).mul(taxRate).toDecimalPlaces(2);
        const total = subtotal.minus(discount).plus(taxAmount);
        const dateCode = new Date().toISOString().slice(0, 10).replaceAll("-", "");
        const suffix = randomBytes(3).toString("hex").toUpperCase();
        const orderNumber = `SO-${dateCode}-${suffix}`;
        const invoiceNumber = `INV-${dateCode}-${randomBytes(3).toString("hex").toUpperCase()}`;

        for (const [productId, quantity] of quantities) {
          const changed = await tx.product.updateMany({
            where: { id: productId, organizationId, active: true, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });
          if (!changed.count) {
            throw new ConflictException(`Insufficient stock for ${productById.get(productId)?.name ?? "a product"}`);
          }
        }

        const order = await tx.order.create({
          data: {
            organizationId,
            customerId: customer.id,
            orderNumber,
            status: OrderStatus.CONFIRMED,
            subtotal: subtotal.toDecimalPlaces(2),
            discount: discount.toDecimalPlaces(2),
            taxRate,
            taxAmount,
            total: total.toDecimalPlaces(2),
            items: {
              create: [...quantities].map(([productId, quantity]) => {
                const product = productById.get(productId)!;
                return {
                  productId,
                  quantity,
                  unitPrice: product.price,
                  lineTotal: product.price.mul(quantity).toDecimalPlaces(2),
                };
              }),
            },
          },
          include: {
            customer: { select: { id: true, name: true } },
            items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          },
        });

        await tx.inventoryMovement.createMany({
          data: [...quantities].map(([productId, quantity]) => ({
            organizationId,
            productId,
            quantity: -quantity,
            reason: `Sale ${orderNumber}`,
          })),
        });
        const invoice = await tx.invoice.create({
          data: {
            organizationId,
            orderId: order.id,
            number: invoiceNumber,
            status: InvoiceStatus.ISSUED,
            issuedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId,
            actorId,
            action: "order.created",
            entity: "order",
            entityId: order.id,
            metadata: { orderNumber },
          },
        });
        return { ...order, invoice };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An order or invoice number conflict occurred. Please try again.");
      }
      throw error;
    }
  }

  async changeStatus(
    organizationId: string,
    actorId: string,
    orderId: string,
    nextStatus: "PAID" | "CANCELLED",
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, organizationId },
        include: { items: true, invoice: true },
      });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status !== OrderStatus.CONFIRMED) {
        throw new ConflictException("Only confirmed orders can be paid or cancelled");
      }

      const changed = await tx.order.updateMany({
        where: { id: orderId, organizationId, status: OrderStatus.CONFIRMED },
        data: { status: nextStatus },
      });
      if (!changed.count) throw new ConflictException("This order was updated by another request");

      if (nextStatus === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          const updated = await tx.product.updateMany({
            where: { id: item.productId, organizationId },
            data: { stock: { increment: item.quantity } },
          });
          if (!updated.count) throw new ConflictException("An order product is no longer available");
          await tx.inventoryMovement.create({
            data: {
              organizationId,
              productId: item.productId,
              quantity: item.quantity,
              reason: `Cancelled order ${order.orderNumber}`,
            },
          });
        }
      }

      if (order.invoice) {
        await tx.invoice.updateMany({
          where: { id: order.invoice.id, organizationId },
          data: { status: nextStatus === OrderStatus.PAID ? InvoiceStatus.PAID : InvoiceStatus.VOID },
        });
      }
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId,
          action: nextStatus === OrderStatus.PAID ? "order.paid" : "order.cancelled",
          entity: "order",
          entityId: orderId,
        },
      });
      return tx.order.findFirstOrThrow({
        where: { id: orderId, organizationId },
        include: { customer: { select: { name: true } }, invoice: true },
      });
    });
  }
}

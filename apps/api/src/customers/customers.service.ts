import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface CustomerInput {
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  tags: string[];
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, search: string, page: number, limit: number) {
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async get(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: {
        orders: {
          select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  async create(organizationId: string, actorId: string, input: CustomerInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: { ...input, email: input.email?.toLowerCase(), organizationId },
        });
        await tx.auditLog.create({
          data: {
            organizationId,
            actorId,
            action: "customer.created",
            entity: "customer",
            entityId: customer.id,
          },
        });
        return customer;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A customer with this email already exists in this organization");
      }
      throw error;
    }
  }

  async update(
    organizationId: string,
    actorId: string,
    customerId: string,
    input: Partial<CustomerInput>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.customer.findFirst({ where: { id: customerId, organizationId } });
      if (!current) throw new NotFoundException("Customer not found");
      try {
        const changed = await tx.customer.updateMany({
          where: { id: customerId, organizationId },
          data: {
            ...input,
            ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
          },
        });
        if (!changed.count) throw new NotFoundException("Customer not found");
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictException("A customer with this email already exists in this organization");
        }
        throw error;
      }
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId,
          action: "customer.updated",
          entity: "customer",
          entityId: customerId,
        },
      });
      return tx.customer.findFirstOrThrow({ where: { id: customerId, organizationId } });
    });
  }

  async remove(organizationId: string, actorId: string, customerId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, organizationId } });
      if (!customer) throw new NotFoundException("Customer not found");
      if (await tx.order.count({ where: { customerId, organizationId } })) {
        throw new ConflictException("Customers with order history cannot be deleted");
      }
      await tx.customer.deleteMany({ where: { id: customerId, organizationId } });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId,
          action: "customer.deleted",
          entity: "customer",
          entityId: customerId,
        },
      });
    });
  }
}

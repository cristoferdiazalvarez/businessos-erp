import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  price: string;
  stock: number;
  lowStockAt: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, search: string, page: number, limit: number) {
    const where: Prisma.ProductWhereInput = {
      organizationId,
      active: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { category: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async categories(organizationId: string) {
    return this.prisma.category.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  async createCategory(organizationId: string, actorId: string, name: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.create({ data: { organizationId, name } });
        await tx.auditLog.create({
          data: { organizationId, actorId, action: "category.created", entity: "category", entityId: category.id },
        });
        return category;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A category with this name already exists in this organization");
      }
      throw error;
    }
  }

  async updateCategory(organizationId: string, actorId: string, categoryId: string, name: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.category.findFirst({ where: { id: categoryId, organizationId } });
        if (!category) throw new NotFoundException("Category not found");
        await tx.category.updateMany({
          where: { id: categoryId, organizationId },
          data: { name },
        });
        await tx.auditLog.create({
          data: { organizationId, actorId, action: "category.updated", entity: "category", entityId: categoryId },
        });
        return tx.category.findFirstOrThrow({ where: { id: categoryId, organizationId } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A category with this name already exists in this organization");
      }
      throw error;
    }
  }

  async removeCategory(organizationId: string, actorId: string, categoryId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.category.deleteMany({ where: { id: categoryId, organizationId } });
      if (!deleted.count) throw new NotFoundException("Category not found");
      await tx.auditLog.create({
        data: { organizationId, actorId, action: "category.removed", entity: "category", entityId: categoryId },
      });
    });
  }

  async create(organizationId: string, actorId: string, input: ProductInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.categoryId) {
          const category = await tx.category.findFirst({
            where: { id: input.categoryId, organizationId },
          });
          if (!category) throw new NotFoundException("Category not found");
        }
        const product = await tx.product.create({
          data: {
            ...input,
            sku: input.sku.trim().toUpperCase(),
            organizationId,
            price: new Prisma.Decimal(input.price),
          },
        });
        if (input.stock > 0) {
          await tx.inventoryMovement.create({
            data: {
              organizationId,
              productId: product.id,
              quantity: input.stock,
              reason: "Opening stock",
            },
          });
        }
        await tx.auditLog.create({
          data: { organizationId, actorId, action: "product.created", entity: "product", entityId: product.id },
        });
        return product;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A product with this SKU already exists in this organization");
      }
      throw error;
    }
  }

  async update(
    organizationId: string,
    actorId: string,
    productId: string,
    input: Partial<ProductInput>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, organizationId, active: true } });
      if (!product) throw new NotFoundException("Product not found");
      if (input.categoryId) {
        const category = await tx.category.findFirst({
          where: { id: input.categoryId, organizationId },
        });
        if (!category) throw new NotFoundException("Category not found");
      }
      const { stock, ...details } = input;
      if (stock !== undefined) {
        throw new ConflictException("Use the stock adjustment endpoint to change inventory");
      }
      try {
        await tx.product.updateMany({
          where: { id: productId, organizationId, active: true },
          data: {
            ...details,
            ...(details.sku ? { sku: details.sku.trim().toUpperCase() } : {}),
            ...(details.price ? { price: new Prisma.Decimal(details.price) } : {}),
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictException("A product with this SKU already exists in this organization");
        }
        throw error;
      }
      await tx.auditLog.create({
        data: { organizationId, actorId, action: "product.updated", entity: "product", entityId: productId },
      });
      return tx.product.findFirstOrThrow({
        where: { id: productId, organizationId },
        include: { category: { select: { id: true, name: true } } },
      });
    });
  }

  async adjustStock(
    organizationId: string,
    actorId: string,
    productId: string,
    quantity: number,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.product.updateMany({
        where: {
          id: productId,
          organizationId,
          active: true,
          ...(quantity < 0
            ? { stock: { gte: Math.abs(quantity) } }
            : { stock: { lte: 2_147_483_647 - quantity } }),
        },
        data: { stock: { increment: quantity } },
      });
      if (!changed.count) {
        const product = await tx.product.findFirst({ where: { id: productId, organizationId, active: true } });
        if (!product) throw new NotFoundException("Product not found");
        throw new ConflictException(
          quantity < 0
            ? "Stock adjustment would make inventory negative"
            : "Stock adjustment exceeds the maximum inventory value",
        );
      }
      const product = await tx.product.findFirstOrThrow({ where: { id: productId, organizationId } });
      await tx.inventoryMovement.create({
        data: { organizationId, productId, quantity, reason },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId,
          action: "inventory.adjusted",
          entity: "product",
          entityId: productId,
          metadata: { quantity, reason },
        },
      });
      return product;
    });
  }

  async movements(organizationId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    return this.prisma.inventoryMovement.findMany({
      where: { organizationId, productId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async remove(organizationId: string, actorId: string, productId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, organizationId, active: true } });
      if (!product) throw new NotFoundException("Product not found");
      await tx.product.updateMany({
        where: { id: productId, organizationId },
        data: { active: false },
      });
      await tx.auditLog.create({
        data: { organizationId, actorId, action: "product.archived", entity: "product", entityId: productId },
      });
    });
  }
}

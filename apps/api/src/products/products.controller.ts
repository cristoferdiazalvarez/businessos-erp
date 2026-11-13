import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ProductsService } from "./products.service";

const listSchema = z.object({
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const priceSchema = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Price must have at most 2 decimal places");
const productSchema = z.object({
  sku: z.string().trim().min(1).max(48),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().cuid().nullable().optional(),
  price: priceSchema,
  stock: z.number().int().min(0).max(1_000_000).default(0),
  lowStockAt: z.number().int().min(0).max(100_000).default(5),
});
const productUpdateSchema = productSchema.partial().refine((value) => Object.keys(value).length > 0);
const stockSchema = z.object({
  quantity: z.number().int().min(-100_000).max(100_000).refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(120),
});
const categorySchema = z.object({ name: z.string().trim().min(1).max(60) });

@ApiTags("Products and inventory")
@Controller("products")
@UseGuards(AuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.products.list(user.organizationId, query.search, query.page, query.limit);
  }

  @Get("categories")
  categories(@CurrentUser() user: AuthPrincipal) {
    return this.products.categories(user.organizationId);
  }

  @Post("categories")
  @Roles(Role.ADMIN, Role.MANAGER)
  createCategory(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(categorySchema)) body: z.infer<typeof categorySchema>,
  ) {
    return this.products.createCategory(user.organizationId, user.id, body.name);
  }

  @Patch("categories/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  updateCategory(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(categorySchema)) body: z.infer<typeof categorySchema>,
  ) {
    return this.products.updateCategory(user.organizationId, user.id, id, body.name);
  }

  @Delete("categories/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  async removeCategory(@CurrentUser() user: AuthPrincipal, @Param("id") id: string): Promise<void> {
    await this.products.removeCategory(user.organizationId, user.id, id);
  }

  @Get(":id/movements")
  movements(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.products.movements(user.organizationId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(productSchema)) body: z.infer<typeof productSchema>,
  ) {
    return this.products.create(user.organizationId, user.id, body);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(productUpdateSchema)) body: z.infer<typeof productUpdateSchema>,
  ) {
    return this.products.update(user.organizationId, user.id, id, body);
  }

  @Post(":id/stock")
  @Roles(Role.ADMIN, Role.MANAGER)
  adjustStock(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(stockSchema)) body: z.infer<typeof stockSchema>,
  ) {
    return this.products.adjustStock(
      user.organizationId,
      user.id,
      id,
      body.quantity,
      body.reason,
    );
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.MANAGER)
  async remove(@CurrentUser() user: AuthPrincipal, @Param("id") id: string): Promise<void> {
    await this.products.remove(user.organizationId, user.id, id);
  }
}

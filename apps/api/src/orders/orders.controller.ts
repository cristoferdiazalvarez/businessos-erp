import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { OrderStatus, Role } from "@prisma/client";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrdersService } from "./orders.service";

const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
});
const amountSchema = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Amount must have at most 2 decimal places");
const createSchema = z.object({
  customerId: z.string().cuid(),
  discount: amountSchema.default("0.00"),
  taxRate: z.number().min(0).max(1).optional(),
  items: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1).max(100_000),
  })).min(1).max(50).refine(
    (items) => new Set(items.map((item) => item.productId)).size === items.length,
    "Each product may only appear once",
  ),
});
const statusSchema = z.object({ status: z.enum([OrderStatus.PAID, OrderStatus.CANCELLED]) });

@ApiTags("Sales orders")
@Controller("orders")
@UseGuards(AuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.orders.list(user.organizationId, query.page, query.limit, query.status);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.orders.get(user.organizationId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: "Create an order and reserve stock in a database transaction" })
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(createSchema)) body: z.infer<typeof createSchema>,
  ) {
    return this.orders.create(user.organizationId, user.id, body);
  }

  @Patch(":id/status")
  @Roles(Role.ADMIN, Role.MANAGER)
  changeStatus(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>,
  ) {
    return this.orders.changeStatus(user.organizationId, user.id, id, body.status);
  }
}

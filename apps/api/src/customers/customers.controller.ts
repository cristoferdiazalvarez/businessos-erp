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
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CustomersService } from "./customers.service";

const listSchema = z.object({
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254).optional(),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
});
const customerUpdateSchema = customerSchema.partial().refine((value) => Object.keys(value).length > 0);

@ApiTags("Customers")
@Controller("customers")
@UseGuards(AuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOperation({ summary: "Search and paginate customers in the current organization" })
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query(new ZodValidationPipe(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.customers.list(user.organizationId, query.search, query.page, query.limit);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthPrincipal, @Param("id") id: string) {
    return this.customers.get(user.organizationId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(customerSchema)) body: z.infer<typeof customerSchema>,
  ) {
    return this.customers.create(user.organizationId, user.id, body);
  }

  @Patch(":id")
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(customerUpdateSchema)) body: z.infer<typeof customerUpdateSchema>,
  ) {
    return this.customers.update(user.organizationId, user.id, id, body);
  }

  @Delete(":id")
  @Roles(Role.ADMIN, Role.MANAGER)
  async remove(@CurrentUser() user: AuthPrincipal, @Param("id") id: string): Promise<void> {
    await this.customers.remove(user.organizationId, user.id, id);
  }
}

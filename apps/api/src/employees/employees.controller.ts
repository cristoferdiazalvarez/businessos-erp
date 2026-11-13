import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { EmployeesService } from "./employees.service";

const inviteSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(1).max(120),
  role: z.nativeEnum(Role),
});
const roleSchema = z.object({ role: z.nativeEnum(Role) });

@ApiTags("Team")
@Controller("employees")
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.employees.list(user.organizationId);
  }

  @Post("invitations")
  @ApiOperation({ summary: "Create a development-only invite token; production email is not configured" })
  invite(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(inviteSchema)) body: z.infer<typeof inviteSchema>,
  ) {
    return this.employees.invite(user.organizationId, user.id, user.role, body);
  }

  @Patch(":id/role")
  @Roles(Role.ADMIN)
  changeRole(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") membershipId: string,
    @Body(new ZodValidationPipe(roleSchema)) body: z.infer<typeof roleSchema>,
  ) {
    return this.employees.changeRole(user.organizationId, user.id, membershipId, body.role);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  async remove(@CurrentUser() user: AuthPrincipal, @Param("id") membershipId: string): Promise<void> {
    await this.employees.remove(user.organizationId, user.id, membershipId);
  }
}

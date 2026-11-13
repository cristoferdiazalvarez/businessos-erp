import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { DashboardService } from "./dashboard.service";

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).optional(),
});

@ApiTags("Dashboard")
@Controller("dashboard")
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  @ApiOperation({ summary: "Return persisted metrics for the current organization" })
  summary(
    @CurrentUser() user: AuthPrincipal,
    @Query(new ZodValidationPipe(querySchema)) query: z.infer<typeof querySchema>,
  ) {
    return this.dashboard.summary(user.organizationId, query.days);
  }
}

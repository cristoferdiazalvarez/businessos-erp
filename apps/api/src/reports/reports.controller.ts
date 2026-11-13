import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ReportsService } from "./reports.service";

const rangeSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "Report start date must not be after end date",
});
const reportTypeSchema = z.enum(["sales", "products", "customers"]);

@ApiTags("Reports")
@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("summary")
  summary(
    @CurrentUser() user: AuthPrincipal,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
  ) {
    return this.reports.summary(user.organizationId, query);
  }

  @Get(":type.csv")
  async export(
    @CurrentUser() user: AuthPrincipal,
    @Param("type", new ZodValidationPipe(reportTypeSchema)) type: z.infer<typeof reportTypeSchema>,
    @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>,
    @Res() response: Response,
  ): Promise<void> {
    const content = await this.reports.exportCsv(user.organizationId, type, query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="businessos-${type}.csv"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).send(content);
  }
}

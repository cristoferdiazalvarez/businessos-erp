import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { InvoiceStatus } from "@prisma/client";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { InvoicesService } from "./invoices.service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(InvoiceStatus).optional(),
});

@ApiTags("Invoices")
@Controller("invoices")
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthPrincipal,
    @Query(new ZodValidationPipe(querySchema)) query: z.infer<typeof querySchema>,
  ) {
    return this.invoices.list(user.organizationId, query.page, query.limit, query.status);
  }

  @Get(":id/pdf")
  @ApiOperation({ summary: "Download the fictional demo invoice PDF" })
  async download(
    @CurrentUser() user: AuthPrincipal,
    @Param("id") id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.invoices.getPdf(user.organizationId, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${file.number}.pdf"`);
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).send(file.content);
  }
}

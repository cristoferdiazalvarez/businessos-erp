import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthPrincipal } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { SettingsService } from "./settings.service";

const profileSchema = z.object({ name: z.string().trim().min(1).max(120) });
const themeSchema = z.object({ theme: z.enum(["light", "dark"]) });
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));
const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  currency: z.string().refine((value) => supportedCurrencies.has(value), "Use a supported ISO currency code"),
  taxRate: z.string().regex(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/),
});

@ApiTags("Settings")
@Controller("settings")
@UseGuards(AuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthPrincipal) {
    return this.settings.get(user.organizationId, user.id);
  }

  @Patch("profile")
  updateProfile(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(profileSchema)) body: z.infer<typeof profileSchema>,
  ) {
    return this.settings.updateProfile(user.organizationId, user.id, body.name);
  }

  @Patch("preferences")
  updateTheme(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(themeSchema)) body: z.infer<typeof themeSchema>,
  ) {
    return this.settings.updateTheme(user.id, body.theme);
  }

  @Patch("organization")
  @Roles(Role.ADMIN)
  updateOrganization(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(organizationSchema)) body: z.infer<typeof organizationSchema>,
  ) {
    return this.settings.updateOrganization(user.organizationId, user.id, body);
  }
}

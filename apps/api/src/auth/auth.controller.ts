import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthGuard, SESSION_COOKIE } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import type { AuthPrincipal } from "./auth.types";

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
const forgotSchema = z.object({ email: z.string().email().max(254) });
const resetSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12).max(128),
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("demo")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Create a one-hour employee-only session for the opt-in read-only public demo" })
  async demo(@Res({ passthrough: true }) response: Response) {
    const result = await this.authService.createDemoSession();
    response.cookie(SESSION_COOKIE, result.token, { ...cookieOptions(), maxAge: 60 * 60 * 1000 });
    return { user: result.user };
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Create a secure, tenant-scoped session" })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    response.cookie(SESSION_COOKIE, result.token, cookieOptions());
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(request.cookies?.[SESSION_COOKIE]);
    response.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthPrincipal) {
    return { user };
  }

  @Post("forgot-password")
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotSchema)) body: z.infer<typeof forgotSchema>,
  ) {
    const demoResetToken = await this.authService.createDemoReset(body.email);
    return {
      message: "If the account exists, password reset instructions are available.",
      ...(demoResetToken ? { demoResetToken } : {}),
      demoOnly: process.env.NODE_ENV !== "production",
    };
  }

  @Post("reset-password")
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resetPassword(
    @Body(new ZodValidationPipe(resetSchema)) body: z.infer<typeof resetSchema>,
  ): Promise<void> {
    await this.authService.resetPassword(body.token, body.password);
  }
}

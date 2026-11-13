import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "./auth.types";

export const SESSION_COOKIE = "businessos_session";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = request.cookies?.[SESSION_COOKIE];
    if (!rawToken) throw new UnauthorizedException("Authentication required");

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException("Authentication required");
    if (session.expiresAt <= new Date()) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException("Session expired");
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.userId,
          organizationId: session.organizationId,
        },
      },
      include: { organization: true },
    });
    if (!membership) {
      await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException("Organization access is no longer available");
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
      theme: session.user.theme === "dark" ? "dark" : "light",
    };
    return true;
  }
}

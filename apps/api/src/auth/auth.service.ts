import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Role } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthPrincipal } from "./auth.types";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string): Promise<{ token: string; user: AuthPrincipal }> {
    await this.limitPublicDemoAuth();
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          include: { organization: true },
          orderBy: { joinedAt: "asc" },
          take: 1,
        },
      },
    });

    const validPassword =
      user !== null && (await argon2.verify(user.passwordHash, password));
    const membership = user?.memberships[0];
    if (!user || !validPassword || !membership) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueSession(user, membership);
  }

  async createDemoSession(): Promise<{ token: string; user: AuthPrincipal }> {
    if (process.env.PUBLIC_DEMO_MODE !== "true") throw new ForbiddenException("Public demo access is disabled");
    await this.limitPublicDemoAuth();
    const membership = await this.prisma.membership.findFirst({
      where: {
        role: "EMPLOYEE",
        organization: { slug: "northstar-studio" },
        user: { email: (process.env.DEMO_EMPLOYEE_EMAIL ?? "employee@businessos.demo").toLowerCase() },
      },
      include: { user: true, organization: true },
    });
    if (!membership) throw new ServiceUnavailableException("Demo access is not ready");
    return this.issueSession(membership.user, membership, 60 * 60 * 1000);
  }

  private async limitPublicDemoAuth(): Promise<void> {
    if (process.env.PUBLIC_DEMO_MODE !== "true") return;
    // Atomic PostgreSQL upsert remains authoritative across serverless instances.
    const [window] = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "DemoAuthWindow" ("id", "count", "expiresAt")
      VALUES ('public-demo-auth', 1, NOW() + INTERVAL '1 minute')
      ON CONFLICT ("id") DO UPDATE SET
        "count" = CASE WHEN "DemoAuthWindow"."expiresAt" <= NOW() THEN 1
          ELSE LEAST("DemoAuthWindow"."count" + 1, 31) END,
        "expiresAt" = CASE WHEN "DemoAuthWindow"."expiresAt" <= NOW()
          THEN NOW() + INTERVAL '1 minute' ELSE "DemoAuthWindow"."expiresAt" END
      RETURNING "count"
    `;
    if (!window || window.count > 30) {
      throw new HttpException("Demo sign-in is busy. Please try again in one minute.", HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }

  private async issueSession(
    user: { id: string; email: string; name: string; theme?: string },
    membership: { organizationId: string; role: Role; organization: { name: string } },
    ttl = SESSION_TTL_MS,
  ): Promise<{ token: string; user: AuthPrincipal }> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        organizationId: membership.organizationId,
        expiresAt: new Date(Date.now() + ttl),
      },
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        role: membership.role,
        theme: user.theme === "dark" ? "dark" : "light",
      },
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  async createDemoReset(email: string): Promise<string | null> {
    if (process.env.NODE_ENV === "production") return null;
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return null;

    const token = randomBytes(32).toString("base64url");
    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    return token;
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new UnprocessableEntityException("Reset link is invalid or expired");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.membership.updateMany({
        where: { userId: reset.userId, invitedAt: { not: null } },
        data: { invitedAt: null, joinedAt: new Date() },
      }),
      this.prisma.session.deleteMany({ where: { userId: reset.userId } }),
    ]);
  }
}

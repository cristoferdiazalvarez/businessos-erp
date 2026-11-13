import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
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

    const token = randomBytes(32).toString("base64url");
    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        organizationId: membership.organizationId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
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

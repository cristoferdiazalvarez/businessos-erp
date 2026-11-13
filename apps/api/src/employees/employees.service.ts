import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, name: true, theme: true } },
      },
      orderBy: [{ invitedAt: "desc" }, { joinedAt: "asc" }],
    });
    return memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      invitedAt: membership.invitedAt,
      joinedAt: membership.joinedAt,
      user: membership.user,
      status: membership.invitedAt ? "INVITED" : "ACTIVE",
    }));
  }

  async invite(
    organizationId: string,
    actorId: string,
    actorRole: Role,
    input: { email: string; name: string; role: Role },
  ) {
    if (actorRole === Role.MANAGER && input.role !== Role.EMPLOYEE) {
      throw new ForbiddenException("Managers may invite employees only");
    }
    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException("Invitation delivery is not configured for production");
    }

    const token = randomBytes(32).toString("base64url");
    const tempPasswordHash = await argon2.hash(randomBytes(32).toString("base64url"), {
      type: argon2.argon2id,
    });
    try {
      const membership = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email.toLowerCase(),
            name: input.name,
            passwordHash: tempPasswordHash,
          },
        });
        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId,
            role: input.role,
            invitedAt: new Date(),
          },
          select: { id: true, role: true, invitedAt: true },
        });
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId,
            actorId,
            action: "employee.invited",
            entity: "membership",
            entityId: membership.id,
          },
        });
        return membership;
      });
      return { ...membership, email: input.email.toLowerCase(), demoInviteToken: token, demoOnly: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("This email already has a BusinessOS account");
      }
      throw error;
    }
  }

  async changeRole(
    organizationId: string,
    actorId: string,
    membershipId: string,
    role: Role,
  ) {
    return this.guardAdminInvariant(() => this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
      });
      if (!membership) throw new NotFoundException("Team member not found");
      if (membership.role === Role.ADMIN && role !== Role.ADMIN) {
        const admins = await tx.membership.count({ where: { organizationId, role: Role.ADMIN } });
        if (admins <= 1) throw new ConflictException("The organization must keep at least one admin");
      }
      await tx.membership.updateMany({
        where: { id: membershipId, organizationId },
        data: { role },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId,
          action: "employee.role_changed",
          entity: "membership",
          entityId: membershipId,
          metadata: { role },
        },
      });
      return tx.membership.findFirstOrThrow({
        where: { id: membershipId, organizationId },
        select: { id: true, role: true, invitedAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  async remove(organizationId: string, actorId: string, membershipId: string): Promise<void> {
    await this.guardAdminInvariant(() => this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.findFirst({
        where: { id: membershipId, organizationId },
      });
      if (!membership) throw new NotFoundException("Team member not found");
      if (membership.userId === actorId) {
        throw new ConflictException("You cannot remove your own membership");
      }
      if (membership.role === Role.ADMIN) {
        const admins = await tx.membership.count({ where: { organizationId, role: Role.ADMIN } });
        if (admins <= 1) throw new ConflictException("The organization must keep at least one admin");
      }
      await tx.session.deleteMany({
        where: { userId: membership.userId, organizationId },
      });
      await tx.membership.deleteMany({ where: { id: membershipId, organizationId } });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId,
          action: "employee.removed",
          entity: "membership",
          entityId: membershipId,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  }

  private async guardAdminInvariant<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("Membership changed concurrently; retry the operation");
      }
      throw error;
    }
  }
}

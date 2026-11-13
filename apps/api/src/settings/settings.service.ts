import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string, userId: string) {
    const [user, organization] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, theme: true },
      }),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true, currency: true, taxRate: true },
      }),
    ]);
    if (!user || !organization) throw new NotFoundException("Settings not found");
    return { profile: user, organization };
  }

  async updateProfile(organizationId: string, userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: { name }, select: { id: true, name: true, email: true } });
      await tx.auditLog.create({
        data: { organizationId, actorId: userId, action: "profile.updated", entity: "user", entityId: userId },
      });
      return user;
    });
  }

  async updateTheme(userId: string, theme: "light" | "dark") {
    return this.prisma.user.update({ where: { id: userId }, data: { theme }, select: { theme: true } });
  }

  async updateOrganization(
    organizationId: string,
    actorId: string,
    input: { name: string; currency: string; taxRate: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: organizationId },
        data: { ...input, taxRate: new Prisma.Decimal(input.taxRate) },
        select: { id: true, name: true, slug: true, currency: true, taxRate: true },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorId,
          action: "organization.settings_updated",
          entity: "organization",
          entityId: organizationId,
        },
      });
      return organization;
    });
  }
}

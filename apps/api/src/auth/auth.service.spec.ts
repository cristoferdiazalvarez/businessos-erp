import { UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";
import type { PrismaService } from "../prisma/prisma.service";

jest.mock("argon2", () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

describe("AuthService", () => {
  const membership = {
    organizationId: "org_1",
    role: "MANAGER",
    organization: { name: "Northstar Studio" },
  };
  const user = {
    id: "user_1",
    email: "manager@example.test",
    name: "Jordan Lee",
    passwordHash: "argon-hash",
    memberships: [membership],
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    session: { create: jest.fn() },
  };
  const service = new AuthService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.session.create.mockResolvedValue({ id: "session_1" });
    (argon2.verify as jest.Mock).mockResolvedValue(true);
  });

  it("creates an opaque token and persists only its hash for the selected organization", async () => {
    const result = await service.login("MANAGER@example.test", "a long demo password");

    expect(result.user).toMatchObject({
      id: "user_1",
      organizationId: "org_1",
      organizationName: "Northstar Studio",
      role: "MANAGER",
    });
    const sessionData = prisma.session.create.mock.calls[0][0].data;
    expect(sessionData.tokenHash).toBe(createHash("sha256").update(result.token).digest("hex"));
    expect(sessionData.tokenHash).not.toBe(result.token);
    expect(sessionData.organizationId).toBe("org_1");
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "manager@example.test" } }),
    );
  });

  it("does not distinguish an invalid password from an unknown account", async () => {
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(service.login("manager@example.test", "wrong password")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it("rejects accounts without an organization membership", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, memberships: [] });

    await expect(service.login("manager@example.test", "password")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

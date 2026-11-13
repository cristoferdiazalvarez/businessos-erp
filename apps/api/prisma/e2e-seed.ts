import { PrismaClient, Role } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.E2E_OTHER_EMAIL ?? "isolation@businessos.demo").toLowerCase();
  const password = process.env.E2E_OTHER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("E2E_OTHER_PASSWORD must be set to a unique password of at least 12 characters.");
  }
  const organization = await prisma.organization.upsert({
    where: { slug: "e2e-isolation-studio" },
    update: { name: "Isolation Test Studio" },
    create: { name: "Isolation Test Studio", slug: "e2e-isolation-studio", currency: "USD" },
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "Isolation Test User", passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
    create: {
      email,
      name: "Isolation Test User",
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
    update: { role: Role.ADMIN },
    create: { userId: user.id, organizationId: organization.id, role: Role.ADMIN },
  });
  await prisma.customer.upsert({
    where: { id: "e2e_other_customer" },
    update: { name: "Isolated Test Customer", email: "isolated@example.test", organizationId: organization.id },
    create: {
      id: "e2e_other_customer",
      organizationId: organization.id,
      name: "Isolated Test Customer",
      email: "isolated@example.test",
      tags: ["E2E"],
    },
  });
  console.log("Created isolated E2E organization.");
}

main()
  .catch((error: unknown) => {
    console.error("E2E seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

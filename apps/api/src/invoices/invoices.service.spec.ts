import { Prisma } from "@prisma/client";
import { InvoicesService } from "./invoices.service";
import type { PrismaService } from "../prisma/prisma.service";

describe("InvoicesService", () => {
  it("renders a PDF from the requested organization-scoped invoice", async () => {
    const invoice = {
      id: "invoice_1",
      number: "INV-DEMO-1",
      status: "ISSUED",
      issuedAt: new Date("2026-01-02T00:00:00.000Z"),
      organization: { name: "Fictional Studio", currency: "USD" },
      order: {
        orderNumber: "SO-DEMO-1",
        subtotal: new Prisma.Decimal("100"),
        discount: new Prisma.Decimal("0"),
        taxRate: new Prisma.Decimal("0.0825"),
        taxAmount: new Prisma.Decimal("8.25"),
        total: new Prisma.Decimal("108.25"),
        customer: { name: "Fictional Buyer", company: "Demo Co.", email: "buyer@example.test" },
        items: [{
          product: { name: "Desk", sku: "DSK-1" },
          quantity: 1,
          unitPrice: new Prisma.Decimal("100"),
          lineTotal: new Prisma.Decimal("100"),
        }],
      },
    };
    const prisma = {
      invoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
    };
    const service = new InvoicesService(prisma as unknown as PrismaService);

    const result = await service.getPdf("org_1", "invoice_1");

    expect(result.number).toBe("INV-DEMO-1");
    expect(result.content.subarray(0, 5).toString()).toBe("%PDF-");
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "invoice_1", organizationId: "org_1" } }),
    );
  });
});

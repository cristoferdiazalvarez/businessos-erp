import { BadRequestException } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import type { PrismaService } from "../prisma/prisma.service";

describe("ReportsService", () => {
  it("rejects date ranges longer than one year", () => {
    const service = new ReportsService({} as PrismaService);

    expect(() => service.resolveRange({ from: "2026-01-01", to: "2027-01-05" })).toThrow(
      BadRequestException,
    );
  });

  it("scopes product CSV aggregation to the requested organization and neutralizes formula cells", async () => {
    const prisma = {
      orderItem: {
        groupBy: jest.fn().mockResolvedValue([{
          productId: "product_1",
          _sum: { quantity: 2, lineTotal: { toFixed: () => "20.00" } },
        }]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{
          id: "product_1",
          sku: "SKU-1",
          name: " =SUM(1,1)",
        }]),
      },
    };
    const service = new ReportsService(prisma as unknown as PrismaService);
    const today = new Date().toISOString().slice(0, 10);

    const result = await service.exportCsv("org_1", "products", { from: today, to: today });

    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        order: expect.objectContaining({ organizationId: "org_1" }),
      }),
    }));
    expect(result).toContain("' =SUM(1,1)");
    expect(result.split("\r\n")[0]).toBe('"SKU","Product","Units sold","Sales"');
  });
});

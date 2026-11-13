import { Injectable, NotFoundException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, page: number, limit: number, status?: "DRAFT" | "ISSUED" | "PAID" | "VOID") {
    const where = { organizationId, ...(status ? { status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          order: { select: { total: true, customer: { select: { name: true, company: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getPdf(organizationId: string, invoiceId: string): Promise<{ number: string; content: Buffer }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        organization: { select: { name: true, currency: true } },
        order: {
          include: {
            customer: { select: { name: true, company: true, email: true } },
            items: {
              include: { product: { select: { name: true, sku: true } } },
              orderBy: { id: "asc" },
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const document = new PDFDocument({ size: "A4", margin: 52, info: { Title: `Invoice ${invoice.number}` } });
    const chunks: Buffer[] = [];
    const content = new Promise<Buffer>((resolve, reject) => {
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
    });

    const green = "#176b53";
    const muted = "#65736b";
    const currency = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.organization.currency,
    });
    const money = (value: number) => currency.format(value);

    document.font("Helvetica-Bold").fontSize(23).fillColor(green).text(invoice.organization.name);
    document.moveDown(0.35);
    document.font("Helvetica").fontSize(9).fillColor(muted).text("BusinessOS demo invoice · Not a tax or legal document");
    document.moveDown(1.8);
    document.font("Helvetica-Bold").fontSize(28).fillColor("#19241f").text("INVOICE", { continued: true });
    document.font("Helvetica").fontSize(11).fillColor(muted).text(`   ${invoice.number}`, { align: "right" });
    document.moveDown(0.5);
    document.fontSize(10).fillColor("#19241f").text(`Status: ${invoice.status.toLowerCase()}`);
    document.text(`Issued: ${invoice.issuedAt?.toLocaleDateString("en-US") ?? "Not issued"}`);
    document.text(`Order: ${invoice.order.orderNumber}`);

    const infoY = document.y + 24;
    document.font("Helvetica-Bold").fontSize(9).fillColor(muted).text("BILL TO", 52, infoY);
    document.font("Helvetica-Bold").fontSize(12).fillColor("#19241f").text(invoice.order.customer.name, 52, infoY + 17);
    if (invoice.order.customer.company) document.font("Helvetica").fontSize(10).fillColor(muted).text(invoice.order.customer.company);
    if (invoice.order.customer.email) document.font("Helvetica").fontSize(10).fillColor(muted).text(invoice.order.customer.email);
    document.y = infoY + 72;

    const drawTableHeader = (top: number) => {
      document.moveTo(52, top).lineTo(543, top).strokeColor("#dce4de").stroke();
      document.font("Helvetica-Bold").fontSize(9).fillColor(muted);
      document.text("ITEM", 52, top + 12);
      document.text("QTY", 350, top + 12, { width: 42, align: "right" });
      document.text("PRICE", 407, top + 12, { width: 62, align: "right" });
      document.text("TOTAL", 477, top + 12, { width: 66, align: "right" });
      return top + 34;
    };
    let rowY = drawTableHeader(document.y + 12);
    for (const item of invoice.order.items) {
      if (rowY + 38 > 700) {
        document.addPage();
        rowY = drawTableHeader(52);
      }
      document.font("Helvetica-Bold").fontSize(10).fillColor("#19241f").text(item.product.name, 52, rowY, { width: 270 });
      document.font("Helvetica").fontSize(8).fillColor(muted).text(item.product.sku, 52, rowY + 14);
      document.font("Helvetica").fontSize(10).fillColor("#19241f").text(String(item.quantity), 350, rowY + 3, { width: 42, align: "right" });
      document.text(money(Number(item.unitPrice)), 407, rowY + 3, { width: 62, align: "right" });
      document.text(money(Number(item.lineTotal)), 477, rowY + 3, { width: 66, align: "right" });
      rowY += 38;
      document.moveTo(52, rowY).lineTo(543, rowY).strokeColor("#edf0ed").stroke();
    }

    rowY += 16;
    if (rowY + 100 > 730) {
      document.addPage();
      rowY = 52;
    }
    const totals = [
      ["Subtotal", money(Number(invoice.order.subtotal))],
      ["Discount", `−${money(Number(invoice.order.discount))}`],
      [`Tax (${(Number(invoice.order.taxRate) * 100).toFixed(2)}%)`, money(Number(invoice.order.taxAmount))],
      ["Total", money(Number(invoice.order.total))],
    ];
    for (const [label, value] of totals) {
      const isTotal = label === "Total";
      document.font(isTotal ? "Helvetica-Bold" : "Helvetica").fontSize(isTotal ? 13 : 10).fillColor("#19241f");
      document.text(label, 350, rowY, { width: 110 });
      document.text(value, 460, rowY, { width: 83, align: "right" });
      rowY += isTotal ? 26 : 20;
    }

    document.font("Helvetica").fontSize(8).fillColor(muted)
      .text("This fictional record is provided for software demonstration only. It is not a tax invoice, legal document, or proof of payment.", 52, document.page.height - 55, { width: 491, align: "center" });
    document.end();
    return { number: invoice.number, content: await content };
  }
}

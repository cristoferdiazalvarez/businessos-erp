"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { api, ApiError, downloadPdf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Invoice {
  id: string;
  number: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  createdAt: string;
  issuedAt: string | null;
  order: { total: string; customer: { name: string; company: string | null } };
}
interface InvoicePage { items: Invoice[]; total: number }

export default function InvoicesPage() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<{ organization: { currency: string } }>("/settings") });
  const currency = settings.data?.organization.currency ?? "USD";
  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: () => api<InvoicePage>("/invoices?page=1&limit=100"),
  });

  async function download(invoice: Invoice) {
    setBusyId(invoice.id);
    try {
      await downloadPdf(`/invoices/${invoice.id}/pdf`, `${invoice.number}.pdf`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not download the invoice.");
    } finally {
      setBusyId(null);
    }
  }

  return <div>
    <div><p className="text-xs font-medium text-muted-foreground">Workspace / Invoices</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Invoices</h1><p className="mt-2 text-sm text-muted-foreground">Downloadable PDF records linked to your sales orders.</p></div>
    <div className="mt-5 rounded-xl border border-[#eadfc7] bg-[#fbf6eb] px-4 py-3 text-xs leading-5 text-[#785c2f] dark:border-[#56472c] dark:bg-[#30291e] dark:text-[#d9c393]">These invoices contain fictional demo data for product demonstration only. They are not tax invoices or legal documents.</div>
    <Card className="mt-6"><CardHeader><CardTitle className="text-base">Invoice records</CardTitle><p className="text-xs text-muted-foreground">{invoices.data ? `${invoices.data.total} records` : "Invoice records are created from saved orders."}</p></CardHeader><CardContent className="px-0 pt-0">
      {invoices.isPending ? <div role="status" className="space-y-3 px-5 py-5"><span className="sr-only">Loading invoices...</span>{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : invoices.error ? <div role="alert" className="px-5 py-12 text-center"><p className="text-sm font-medium">Couldn&apos;t load invoices.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => invoices.refetch()}>Try again</Button></div> : invoices.data.items.length === 0 ? <div className="px-5 py-16 text-center"><FileText className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">No invoices yet</p><p className="mt-1 text-xs text-muted-foreground">Invoices will appear when sales orders are created.</p></div> :
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Issued</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Total</th><th className="px-5 py-3 text-right font-medium">PDF</th></tr></thead><tbody className="divide-y divide-border">{invoices.data.items.map((invoice) => <tr key={invoice.id} className="hover:bg-muted/30"><td className="px-5 py-3.5"><p className="font-medium">{invoice.number}</p><p className="mt-0.5 text-xs text-muted-foreground">Created {formatDate(invoice.createdAt)}</p></td><td className="px-4 py-3.5"><p>{invoice.order.customer.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{invoice.order.customer.company ?? ""}</p></td><td className="px-4 py-3.5 text-xs text-muted-foreground">{invoice.issuedAt ? formatDate(invoice.issuedAt) : "Not issued"}</td><td className="px-4 py-3.5"><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">{invoice.status.toLowerCase()}</span></td><td className="px-4 py-3.5 text-right font-semibold">{formatCurrency(Number(invoice.order.total), currency)}</td><td className="px-5 py-3.5 text-right"><Button variant="outline" size="sm" onClick={() => download(invoice)} disabled={busyId === invoice.id} aria-label={`Download invoice ${invoice.number}`}>{busyId === invoice.id ? "Preparing..." : <><Download size={14} /> Download PDF</>}</Button></td></tr>)}</tbody></table></div>}
    </CardContent></Card>
  </div>;
}

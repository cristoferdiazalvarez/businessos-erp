"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ArrowDownToLine, BarChart3, UsersRound } from "lucide-react";
import { api, ApiError, downloadCsv } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ReportSummary {
  from: string;
  to: string;
  currency: string;
  revenue: number;
  orders: number;
  revenueSeries: Array<{ date: string; revenue: number }>;
  topProducts: Array<{ id?: string; sku?: string; name?: string; quantity: number; revenue: number }>;
  topCustomers: Array<{ id?: string; name?: string; company?: string | null; orders: number; revenue: number }>;
}

function defaultDates() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const defaults = defaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const report = useQuery({
    queryKey: ["reports", from, to],
    queryFn: () => api<ReportSummary>(`/reports/summary?from=${from}&to=${to}`),
  });

  async function exportCsv(type: "sales" | "products" | "customers") {
    try {
      await downloadCsv(`/reports/${type}.csv?from=${from}&to=${to}`, `businessos-${type}-${from}-to-${to}.csv`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not export this report.");
    }
  }

  const data = report.data;
  return <div>
    <div><p className="text-xs font-medium text-muted-foreground">Workspace / Reports</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Reports</h1><p className="mt-2 text-sm text-muted-foreground">Explore saved sales, product, and customer activity.</p></div>
    <Card className="mt-6"><CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle className="text-base">Date range</CardTitle><p className="mt-1 text-xs text-muted-foreground">Choose up to 366 days of saved activity.</p></div><div className="flex flex-wrap items-end gap-3"><label className="text-xs font-medium">From<input aria-label="Report start date" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="form-input min-w-[155px]" /></label><label className="text-xs font-medium">To<input aria-label="Report end date" type="date" value={to} min={from} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setTo(event.target.value)} className="form-input min-w-[155px]" /></label></div></CardHeader></Card>
    {report.isPending ? <div role="status" className="mt-5 grid gap-4 sm:grid-cols-2"><span className="sr-only">Loading reports...</span>{[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div> : report.error ? <div role="alert" className="mt-5 rounded-2xl border border-destructive/20 bg-card p-8 text-center"><p className="text-sm font-medium">{report.error instanceof ApiError ? report.error.message : "Reports are unavailable."}</p><Button variant="outline" className="mt-3" onClick={() => report.refetch()}>Try again</Button></div> : data && <div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Recognized revenue</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(data.revenue, data.currency)}</p><p className="mt-2 text-xs text-muted-foreground">Paid and confirmed orders · {data.from} to {data.to}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Orders recorded</p><p className="mt-2 text-2xl font-semibold">{data.orders.toLocaleString("en-US")}</p><p className="mt-2 text-xs text-muted-foreground">Paid and confirmed orders in this period</p></CardContent></Card></div>
      <Card className="mt-4"><CardHeader><CardTitle className="text-base">Sales over time</CardTitle><p className="text-xs text-muted-foreground">Calculated from persisted order totals</p></CardHeader><CardContent className="h-[280px] px-2 pb-5 sm:px-5">{data.revenueSeries.every((point) => point.revenue === 0) ? <div className="grid h-full place-items-center text-center"><div><BarChart3 className="mx-auto text-muted-foreground" size={22} /><p className="mt-3 text-sm font-medium">No sales in this period</p></div></div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.revenueSeries} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}><defs><linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="date" tickFormatter={(value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tickLine={false} axisLine={false} minTickGap={30} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><YAxis tickFormatter={(value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: data.currency, notation: "compact", maximumFractionDigits: 1 }).format(value)} tickLine={false} axisLine={false} width={66} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} /><Tooltip formatter={(value) => [formatCurrency(Number(value), data.currency), "Revenue"]} labelFormatter={(value) => new Date(`${String(value)}T00:00:00`).toLocaleDateString("en-US", { dateStyle: "medium" })} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} /><Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#reportFill)" /></AreaChart></ResponsiveContainer>}</CardContent></Card>
      <div className="mt-4 grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Top products</CardTitle><p className="text-xs text-muted-foreground">By recognized line-item sales</p></CardHeader><CardContent className="px-0 pt-0">{data.topProducts.length ? <div className="divide-y divide-border">{data.topProducts.map((product) => <div key={product.id ?? product.sku} className="flex items-center justify-between gap-4 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{product.name}</p><p className="mt-1 text-xs text-muted-foreground">{product.sku} · {product.quantity} units</p></div><span className="shrink-0 text-sm font-semibold">{formatCurrency(product.revenue, data.currency)}</span></div>)}</div> : <p className="px-5 py-8 text-center text-sm text-muted-foreground">No product sales in this period.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Top customers</CardTitle><p className="text-xs text-muted-foreground">By paid and confirmed order totals</p></CardHeader><CardContent className="px-0 pt-0">{data.topCustomers.length ? <div className="divide-y divide-border">{data.topCustomers.map((customer) => <div key={customer.id ?? customer.name} className="flex items-center justify-between gap-4 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{customer.name}</p><p className="mt-1 text-xs text-muted-foreground">{customer.company ?? "Customer"} · {customer.orders} orders</p></div><span className="shrink-0 text-sm font-semibold">{formatCurrency(customer.revenue, data.currency)}</span></div>)}</div> : <div className="px-5 py-8 text-center"><UsersRound className="mx-auto text-muted-foreground" size={20} /><p className="mt-2 text-sm text-muted-foreground">No customer sales in this period.</p></div>}</CardContent></Card>
      </div>
    </div>}
    <Card className="mt-5"><CardHeader><CardTitle className="text-base">Export data</CardTitle><p className="text-xs text-muted-foreground">CSV exports use the selected dates and current organization access.</p></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => exportCsv("sales")} disabled={!data}><ArrowDownToLine size={14} /> Sales CSV</Button><Button variant="outline" size="sm" onClick={() => exportCsv("products")} disabled={!data}><ArrowDownToLine size={14} /> Products CSV</Button><Button variant="outline" size="sm" onClick={() => exportCsv("customers")} disabled={!data}><ArrowDownToLine size={14} /> Customers CSV</Button></CardContent></Card>
  </div>;
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, Boxes, ChevronDown, CircleDollarSign, FileDown, ShoppingBag, UsersRound } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError, type DashboardSummary } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

const periods = [7, 30, 90] as const;

function currencyCompact(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function DashboardLoading() {
  return <div role="status" className="space-y-5"><span className="sr-only">Loading dashboard data...</span><div className="h-20 animate-pulse rounded-2xl bg-muted" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-muted" />)}<div className="h-80 animate-pulse rounded-2xl bg-muted sm:col-span-2 xl:col-span-4" /></div></div>;
}

export default function DashboardPage() {
  const [days, setDays] = useState<(typeof periods)[number]>(30);
  const dashboard = useQuery({
    queryKey: ["dashboard", days],
    queryFn: () => api<DashboardSummary>(`/dashboard/summary?days=${days}`),
  });

  if (dashboard.isPending) return <DashboardLoading />;
  if (dashboard.error) {
    const message = dashboard.error instanceof ApiError && dashboard.error.status === 401
      ? "Your session has expired. Sign in again to continue."
      : "We couldn’t load your dashboard. Check your connection and try again.";
    return <section className="rounded-2xl border border-destructive/20 bg-card p-8 text-center" role="alert"><div className="mx-auto grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive"><Activity size={19} /></div><h1 className="mt-4 text-lg font-semibold">Dashboard unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><Button variant="outline" className="mt-5" onClick={() => dashboard.refetch()}>Try again</Button></section>;
  }

  const data = dashboard.data;
  const metrics = [
    { title: "Revenue", value: formatCurrency(data.kpis.revenue, data.currency), note: `Paid and confirmed · ${days} days`, icon: CircleDollarSign, tone: "text-primary bg-secondary" },
    { title: "Orders", value: data.kpis.orders.toLocaleString("en-US"), note: `Created in the last ${days} days`, icon: ShoppingBag, tone: "text-[#7f64bd] bg-[#f0ecfa] dark:bg-[#302a40]" },
    { title: "Customers", value: data.kpis.customers.toLocaleString("en-US"), note: "In this workspace", icon: UsersRound, tone: "text-[#bd7e39] bg-[#fbf0e2] dark:bg-[#403322]" },
    { title: "Products", value: data.kpis.products.toLocaleString("en-US"), note: `${data.kpis.lowStock} need a restock`, icon: Boxes, tone: "text-[#438ba0] bg-[#e8f4f6] dark:bg-[#22383d]" },
  ];

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><p className="text-xs font-medium text-muted-foreground">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Good morning<span className="text-primary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your business.</p></div>
        <div className="flex items-center gap-2">
          <label htmlFor="period" className="sr-only">Dashboard date range</label>
          <div className="relative">
            <select id="period" value={days} onChange={(event) => setDays(Number(event.target.value) as (typeof periods)[number])} className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-9 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/20">
              {periods.map((period) => <option value={period} key={period}>Last {period} days</option>)}
            </select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Link href="/app/reports" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted"><FileDown size={16} /> Reports</Link>
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ title, value, note, icon: Icon, tone }) => <Card key={title}>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-2"><div><p className="text-sm font-medium text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon size={18} /></span></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{note}</p></CardContent>
        </Card>)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div><CardTitle className="text-base">Revenue over time</CardTitle><p className="mt-1 text-xs text-muted-foreground">Confirmed and paid orders · {days} days</p></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"><span className="size-1.5 rounded-full bg-primary" /> Persisted data</span>
          </CardHeader>
          <CardContent className="h-[280px] px-2 pb-5 sm:px-5">
            {data.revenueSeries.every((point) => point.revenue === 0) ? <div className="grid h-full place-items-center text-center"><div><Activity className="mx-auto text-muted-foreground" size={22} /><p className="mt-3 text-sm font-medium">No sales in this period yet</p><p className="mt-1 text-xs text-muted-foreground">Revenue will appear here as orders are recorded.</p></div></div> :
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueSeries} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                  <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.19} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tickLine={false} axisLine={false} minTickGap={30} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis tickFormatter={(value: number) => currencyCompact(value, data.currency)} tickLine={false} axisLine={false} width={66} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value), data.currency), "Revenue"]} labelFormatter={(value) => new Date(`${String(value)}T00:00:00`).toLocaleDateString("en-US", { dateStyle: "medium" })} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
                  <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#revenueFill)" activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 3 }} />
                </AreaChart>
              </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent orders</CardTitle><p className="text-xs text-muted-foreground">Latest activity in this workspace</p></CardHeader>
          <CardContent className="px-0 pt-0">
            {data.recentOrders.length === 0 ? <div className="px-5 py-10 text-center"><ShoppingBag className="mx-auto text-muted-foreground" size={22} /><p className="mt-3 text-sm font-medium">No orders yet</p><p className="mt-1 text-xs text-muted-foreground">Orders will appear here once they are created.</p></div> :
              <div className="divide-y divide-border">
                {data.recentOrders.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{order.customer}</p><p className="mt-1 text-xs text-muted-foreground">{order.orderNumber} · {formatDate(order.createdAt)}</p></div>
                  <div className="shrink-0 text-right"><p className="text-sm font-semibold">{formatCurrency(order.total, data.currency)}</p><span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium ${order.status === "PAID" ? "text-primary" : "text-[#a76d2d]"}`}>{order.status === "PAID" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{order.status.toLowerCase()}</span></div>
                </div>)}
              </div>}
          </CardContent>
        </Card>
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">Fictional demo data · Invoices are not tax or legal documents.</p>
    </div>
  );
}

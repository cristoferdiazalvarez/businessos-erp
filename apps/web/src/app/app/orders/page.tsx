"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Plus, ShoppingBag, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CustomerOption { id: string; name: string; company: string | null }
interface ProductOption { id: string; sku: string; name: string; price: string; stock: number }
interface Order {
  id: string;
  orderNumber: string;
  status: "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
  total: string;
  createdAt: string;
  customer: { name: string; company: string | null };
  invoice: { id: string; number: string; status: string } | null;
}
interface OrderPage { items: Order[]; total: number; pages: number; page: number }

const orderSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  discount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a discount with up to 2 decimal places"),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(100000),
  })).min(1, "Add at least one product"),
});

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<{ user: { role: string } }>("/auth/me") });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<{ organization: { currency: string } }>("/settings") });
  const currency = settings.data?.organization.currency ?? "USD";
  const canEdit = Boolean(session.data && session.data.user.role !== "EMPLOYEE");
  const customers = useQuery({ queryKey: ["order-customers"], queryFn: () => api<{ items: CustomerOption[] }>("/customers?page=1&limit=100") });
  const products = useQuery({ queryKey: ["order-products"], queryFn: () => api<{ items: ProductOption[] }>("/products?page=1&limit=100") });
  const orders = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => api<OrderPage>(`/orders?page=1&limit=50${filter ? `&status=${filter}` : ""}`),
  });
  const create = useMutation({
    mutationFn: (data: z.infer<typeof orderSchema>) => api<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: async (order) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      ]);
      setShowForm(false);
      toast.success(`Order ${order.orderNumber} created`);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not create this order."),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "PAID" | "CANCELLED" }) =>
      api<Order>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: async (_order, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      ]);
      toast.success(variables.status === "PAID" ? "Order marked paid" : "Order cancelled and stock restored");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update this order."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const productIds = formData.getAll("productId").map(String);
    const quantities = formData.getAll("quantity").map(String);
    if (productIds.some((productId, index) => !productId && quantities[index])) {
      toast.error("Choose a product for each quantity entered.");
      return;
    }
    const parsed = orderSchema.safeParse({
      customerId: formData.get("customerId"),
      discount: formData.get("discount") || "0.00",
      items: productIds.flatMap((productId, index) =>
        productId ? [{ productId, quantity: quantities[index] }] : [],
      ),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the order details."); return; }
    create.mutate(parsed.data);
  }

  function changeStatus(order: Order, status: "PAID" | "CANCELLED") {
    const action = status === "PAID" ? `Mark ${order.orderNumber} as paid?` : `Cancel ${order.orderNumber} and return its items to stock?`;
    if (window.confirm(action)) updateStatus.mutate({ id: order.id, status });
  }

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-medium text-muted-foreground">Workspace / Sales</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Sales</h1><p className="mt-2 text-sm text-muted-foreground">Orders, stock reservations, totals, and invoice records.</p></div>{canEdit && <Button onClick={() => setShowForm(true)}><Plus size={16} /> Create order</Button>}</div>
    <div className="mt-5 rounded-xl border border-[#eadfc7] bg-[#fbf6eb] px-4 py-3 text-xs leading-5 text-[#785c2f] dark:border-[#56472c] dark:bg-[#30291e] dark:text-[#d9c393]">Creating an order reserves stock and generates its invoice. Cancelling a confirmed order restores the reserved stock.</div>

    {showForm && <Card className="mt-5"><CardHeader className="flex-row justify-between"><div><CardTitle>Create a sales order</CardTitle><p className="mt-1 text-xs text-muted-foreground">Current catalog prices and your organization&apos;s tax rate are used by the server.</p></div><button type="button" aria-label="Close order form" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></CardHeader><CardContent>
      {customers.isPending || products.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading customers and products...</p> : customers.error || products.error ? <p role="alert" className="text-sm text-destructive">Customers or products could not be loaded. Please try again.</p> : <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Customer<select name="customerId" required className="form-input"><option value="">Select a customer</option>{customers.data.items.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}{customer.company ? ` · ${customer.company}` : ""}</option>)}</select></label><label className="text-sm font-medium">Discount ({currency})<input name="discount" type="number" step="0.01" min="0" defaultValue="0.00" className="form-input" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Currency amount; must not exceed the subtotal.</span></label></div>
        <div><h3 className="text-sm font-semibold">Items</h3><div className="mt-3 space-y-3">
          {[0, 1, 2].map((line) => <div key={line} className="grid gap-3 sm:grid-cols-[1fr_150px]"><label className="text-xs font-medium text-muted-foreground">Product {line + 1}<select name="productId" defaultValue="" required={line === 0} className="form-input"><option value="">Select a product</option>{products.data.items.map((product) => <option key={product.id} value={product.id} disabled={product.stock === 0}>{product.name} · {product.sku} · {formatCurrency(Number(product.price), currency)} · {product.stock} in stock</option>)}</select></label><label className="text-xs font-medium text-muted-foreground">Quantity<input name="quantity" type="number" min={1} max={100000} defaultValue={line === 0 ? 1 : ""} required={line === 0} className="form-input" /></label></div>)}
        </div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="max-w-lg text-xs leading-5 text-muted-foreground">Totals and tax are calculated automatically. Every item must have enough stock to create this order.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={create.isPending || customers.data.items.length === 0 || products.data.items.length === 0}>{create.isPending ? "Creating..." : "Create order"}</Button></div></div>
      </form>}
    </CardContent></Card>}

    <Card className="mt-6"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Orders</CardTitle><p className="mt-1 text-xs text-muted-foreground">{orders.data ? `${orders.data.total} total records` : "Review and update order activity"}</p></div><label className="text-xs text-muted-foreground">Filter status<select aria-label="Filter orders by status" value={filter} onChange={(event) => setFilter(event.target.value)} className="ml-2 h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground"><option value="">All statuses</option><option value="CONFIRMED">Confirmed</option><option value="PAID">Paid</option><option value="CANCELLED">Cancelled</option><option value="DRAFT">Draft</option></select></label></CardHeader><CardContent className="px-0 pt-0">
      {orders.isPending ? <div role="status" className="space-y-3 px-5 py-5"><span className="sr-only">Loading orders...</span>{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : orders.error ? <div role="alert" className="px-5 py-12 text-center"><p className="text-sm font-medium">Couldn&apos;t load orders.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => orders.refetch()}>Try again</Button></div> : orders.data.items.length === 0 ? <div className="px-5 py-16 text-center"><ShoppingBag className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">No orders found</p><p className="mt-1 text-xs text-muted-foreground">{filter ? "Try another status filter." : "Create an order to begin recording sales."}</p>{canEdit && !filter && <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}><Plus size={15} /> Create order</Button>}</div> :
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-y border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Total</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-border">{orders.data.items.map((order) => <tr key={order.id} className="hover:bg-muted/30"><td className="px-5 py-3.5 font-medium">{order.orderNumber}</td><td className="px-4 py-3.5">{order.customer.name}</td><td className="px-4 py-3.5 text-xs text-muted-foreground">{formatDate(order.createdAt)}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${order.status === "PAID" ? "bg-secondary text-secondary-foreground" : order.status === "CANCELLED" ? "bg-muted text-muted-foreground" : "bg-[#fbf0e2] text-[#a46c2c] dark:bg-[#403322]"}`}>{order.status.toLowerCase()}</span></td><td className="px-5 py-3.5 text-right font-semibold">{formatCurrency(Number(order.total), currency)}</td><td className="px-5 py-3.5"><div className="flex justify-end gap-1">{canEdit && order.status === "CONFIRMED" && <><Button variant="ghost" size="sm" onClick={() => changeStatus(order, "PAID")} disabled={updateStatus.isPending}><ArrowUpRight size={14} /> Mark paid</Button><Button variant="ghost" size="sm" onClick={() => changeStatus(order, "CANCELLED")} disabled={updateStatus.isPending}><ArrowDownRight size={14} /> Cancel</Button></>}</div></td></tr>)}</tbody></table></div>}
    </CardContent></Card>
    <p className="mt-5 text-center text-xs text-muted-foreground">Invoices are demonstration records only and are not tax or legal documents.</p>
  </div>;
}

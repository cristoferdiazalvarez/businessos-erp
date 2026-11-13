"use client";

import { useDeferredValue, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Building2, Clock3, Pencil, Plus, Search, Trash2, UsersRound, X } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  tags: string[];
  createdAt: string;
}

interface CustomerPage {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface CustomerHistory extends Customer {
  orders: Array<{ id: string; orderNumber: string; status: string; total: string; createdAt: string }>;
}

const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.union([z.string().email("Enter a valid email address").max(254), z.literal("")]),
  company: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  tags: z.string().max(360),
});

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<{ user: { role: string } }>("/auth/me") });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<{ organization: { currency: string } }>("/settings") });
  const currency = settings.data?.organization.currency ?? "USD";
  const canEdit = Boolean(session.data && session.data.user.role !== "EMPLOYEE");
  const customers = useQuery({
    queryKey: ["customers", deferredSearch, page],
    queryFn: () => api<CustomerPage>(`/customers?search=${encodeURIComponent(deferredSearch)}&page=${page}&limit=10`),
    placeholderData: (previous) => previous,
  });
  const history = useQuery({
    queryKey: ["customer-history", historyId],
    queryFn: () => api<CustomerHistory>(`/customers/${historyId}`),
    enabled: Boolean(historyId),
  });
  const save = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: z.infer<typeof customerSchema> }) =>
      api<Customer>(id ? `/customers/${id}` : "/customers", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({
          name: data.name,
          email: data.email || undefined,
          company: data.company || undefined,
          phone: data.phone || undefined,
          tags: data.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? "Customer updated" : "Customer added");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not save this customer."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/customers/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (historyId) setHistoryId(null);
      toast.success("Customer deleted");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not delete this customer."),
  });

  function startCreate() { setEditing(null); setShowForm(true); }
  function startEdit(customer: Customer) { setEditing(customer); setHistoryId(null); setShowForm(true); }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const parsed = customerSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form fields.");
      return;
    }
    save.mutate({ id: editing?.id, data: parsed.data });
  }

  function confirmDelete(customer: Customer) {
    if (window.confirm(`Delete ${customer.name}? Customers with order history cannot be deleted.`)) remove.mutate(customer.id);
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-medium text-muted-foreground">Workspace / Customers</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Customers</h1><p className="mt-2 text-sm text-muted-foreground">Keep the people and businesses you work with close.</p></div>
        {canEdit && <Button onClick={startCreate}><Plus size={16} /> Add customer</Button>}
      </div>

      {showForm && <Card className="mt-6">
        <CardHeader className="flex-row items-start justify-between"><div><CardTitle>{editing ? "Edit customer" : "Add a customer"}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Customer details are saved to this organization.</p></div><button type="button" aria-label="Close customer form" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></CardHeader>
        <CardContent><form key={editing?.id ?? "new"} onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium">Full name<input name="name" required maxLength={120} defaultValue={editing?.name ?? ""} className="form-input" placeholder="e.g. Olivia Chen" /></label>
          <label className="text-sm font-medium">Email<input name="email" type="email" maxLength={254} defaultValue={editing?.email ?? ""} className="form-input" placeholder="name@company.com" /></label>
          <label className="text-sm font-medium">Company<input name="company" maxLength={120} defaultValue={editing?.company ?? ""} className="form-input" placeholder="Company name" /></label>
          <label className="text-sm font-medium">Phone<input name="phone" type="tel" maxLength={40} defaultValue={editing?.phone ?? ""} className="form-input" placeholder="+1 555 0100" /></label>
          <label className="text-sm font-medium sm:col-span-2">Tags <span className="font-normal text-muted-foreground">(comma separated)</span><input name="tags" maxLength={360} defaultValue={editing?.tags.join(", ") ?? ""} className="form-input" placeholder="Design, Wholesale" /></label>
          <div className="flex items-end gap-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Create customer"}</Button><Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button></div>
        </form></CardContent>
      </Card>}

      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Your customers</CardTitle><p className="mt-1 text-xs text-muted-foreground">{customers.data ? `${customers.data.total} records` : "Search and manage customer records"}</p></div><label className="relative block w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Search customers</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" placeholder="Search name, email or company" /></label></CardHeader>
        <CardContent className="px-0 pt-0">
          {customers.isPending ? <div role="status" className="space-y-3 px-5 py-5"><span className="sr-only">Loading customers...</span>{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> :
          customers.error ? <div role="alert" className="px-5 py-12 text-center"><p className="text-sm font-medium">Couldn&apos;t load customers.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => customers.refetch()}>Try again</Button></div> :
          customers.data.items.length === 0 ? <div className="px-5 py-16 text-center"><UsersRound className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">{deferredSearch ? "No matching customers" : "No customers yet"}</p><p className="mt-1 text-xs text-muted-foreground">{deferredSearch ? "Try another search." : "Create a customer to start building your workspace."}</p>{canEdit && !deferredSearch && <Button size="sm" className="mt-4" onClick={startCreate}><Plus size={15} /> Add customer</Button>}</div> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm"><thead className="border-y border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Company</th><th className="px-4 py-3 font-medium">Tags</th><th className="px-4 py-3 font-medium">Added</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-border">
              {customers.data.items.map((customer) => <tr key={customer.id} className="hover:bg-muted/30">
                <td className="px-5 py-3.5"><p className="font-medium">{customer.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{customer.email ?? customer.phone ?? "No contact details"}</p></td>
                <td className="px-4 py-3.5 text-muted-foreground">{customer.company ?? "—"}</td>
                <td className="px-4 py-3.5"><div className="flex max-w-[190px] flex-wrap gap-1">{customer.tags.map((tag) => <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{tag}</span>)}{customer.tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}</div></td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{formatDate(customer.createdAt)}</td>
                <td className="px-5 py-3.5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setHistoryId(historyId === customer.id ? null : customer.id)} aria-label={`View ${customer.name} history`}><Clock3 size={15} /> History</Button>{canEdit && <><Button variant="ghost" size="icon" aria-label={`Edit ${customer.name}`} onClick={() => startEdit(customer)}><Pencil size={15} /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${customer.name}`} onClick={() => confirmDelete(customer)} disabled={remove.isPending}><Trash2 size={15} /></Button></>}</div></td>
              </tr>)}
            </tbody></table>
          </div>}
          {historyId && <div className="border-t border-border bg-muted/20 px-5 py-4">
            {history.isPending ? <p role="status" className="text-xs text-muted-foreground">Loading customer history...</p> : history.error ? <p role="alert" className="text-xs text-destructive">Could not load this customer&apos;s history.</p> : <div><div className="flex items-center gap-2 text-sm font-semibold"><Building2 size={15} /> {history.data.name} · Order history</div>            {history.data.orders.length ? <div className="mt-3 space-y-2">{history.data.orders.map((order) => <div key={order.id} className="flex justify-between gap-3 text-xs"><span>{order.orderNumber} · {formatDate(order.createdAt)} · {order.status.toLowerCase()}</span><span className="font-medium">{formatCurrency(Number(order.total), currency)}</span></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">No orders recorded for this customer yet.</p>}</div>}
          </div>}
          {customers.data && customers.data.pages > 1 && <div className="flex items-center justify-between border-t border-border px-5 py-3"><p className="text-xs text-muted-foreground">Page {customers.data.page} of {customers.data.pages}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}><ArrowLeft size={14} /> Previous</Button><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.min(customers.data!.pages, value + 1))} disabled={page >= customers.data.pages}>Next <ArrowRight size={14} /></Button></div></div>}
        </CardContent>
      </Card>
    </div>
  );
}

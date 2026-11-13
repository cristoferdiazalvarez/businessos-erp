"use client";

import { useDeferredValue, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Activity, ArrowLeft, ArrowRight, Boxes, Pencil, Plus, Search, Tags, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  lowStockAt: number;
  categoryId: string | null;
  category: { id: string; name: string } | null;
}
interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
interface Category { id: string; name: string }
interface Movement { id: string; quantity: number; reason: string; createdAt: string }

const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(48),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(1000),
  categoryId: z.string(),
  price: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a price with up to 2 decimal places"),
  lowStockAt: z.coerce.number().int().min(0).max(100000),
});
const categoryNameSchema = z.string().trim().min(1, "Category name is required").max(60);

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [movementProductId, setMovementProductId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<{ user: { role: string } }>("/auth/me") });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<{ organization: { currency: string } }>("/settings") });
  const currency = settings.data?.organization.currency ?? "USD";
  const canEdit = Boolean(session.data && session.data.user.role !== "EMPLOYEE");
  const products = useQuery({
    queryKey: ["products", deferredSearch, page],
    queryFn: () => api<ProductPage>(`/products?search=${encodeURIComponent(deferredSearch)}&page=${page}&limit=10`),
    placeholderData: (previous) => previous,
  });
  const categories = useQuery({ queryKey: ["product-categories"], queryFn: () => api<Category[]>("/products/categories") });
  const saveCategory = useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) =>
      api<Category>(id ? `/products/categories/${id}` : "/products/categories", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      setEditingCategoryId(null);
      setCategoryName("");
      toast.success(editingCategoryId ? "Category updated" : "Category added");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not save this category."),
  });
  const removeCategory = useMutation({
    mutationFn: (id: string) => api<void>(`/products/categories/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Category removed");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not remove this category."),
  });
  const movements = useQuery({
    queryKey: ["inventory-movements", movementProductId],
    queryFn: () => api<Movement[]>(`/products/${movementProductId}/movements`),
    enabled: Boolean(movementProductId),
  });
  const save = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: z.infer<typeof productSchema> }) =>
      api<Product>(id ? `/products/${id}` : "/products", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({
          sku: values.sku,
          name: values.name,
          description: values.description || undefined,
          categoryId: values.categoryId || (id ? null : undefined),
          price: values.price,
          ...(id ? {} : { stock: 0 }),
          lowStockAt: values.lowStockAt,
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? "Product updated" : "Product added");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not save this product."),
  });
  const adjust = useMutation({
    mutationFn: ({ productId, quantity, reason }: { productId: string; quantity: number; reason: string }) =>
      api<Product>(`/products/${productId}/stock`, { method: "POST", body: JSON.stringify({ quantity, reason }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      setAdjusting(null);
      toast.success("Inventory updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not adjust inventory."),
  });
  const archive = useMutation({
    mutationFn: (id: string) => api<void>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Product archived");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not archive this product."),
  });

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const parsed = productSchema.safeParse(values);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the form fields."); return; }
    save.mutate({ id: editing?.id, values: parsed.data });
  }

  function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = categoryNameSchema.safeParse(categoryName);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the category name."); return; }
    saveCategory.mutate({ id: editingCategoryId ?? undefined, name: parsed.data });
  }

  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const quantity = Number(values.get("quantity"));
    const reason = String(values.get("reason") ?? "").trim();
    if (!Number.isInteger(quantity) || quantity === 0 || !reason) {
      toast.error("Enter a non-zero whole number and a reason.");
      return;
    }
    if (adjusting) adjust.mutate({ productId: adjusting.id, quantity, reason });
  }

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-medium text-muted-foreground">Workspace / Products & stock</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Products & stock</h1><p className="mt-2 text-sm text-muted-foreground">Track your catalog, pricing, and inventory movements.</p></div>{canEdit && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowCategories((value) => !value)}><Tags size={16} /> Manage categories</Button><Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Add product</Button></div>}</div>

    {showCategories && canEdit && <Card className="mt-6"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Product categories</CardTitle><p className="mt-1 text-xs text-muted-foreground">Organize products with workspace-specific categories.</p></div><button type="button" onClick={() => setShowCategories(false)} aria-label="Close category manager" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></CardHeader><CardContent className="space-y-4">
      <form onSubmit={submitCategory} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">Category name<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required maxLength={60} className="form-input" placeholder="e.g. Accessories" /></label><div className="flex gap-2"><Button type="submit" disabled={saveCategory.isPending}>{saveCategory.isPending ? "Saving..." : editingCategoryId ? "Save category" : "Add category"}</Button>{editingCategoryId && <Button type="button" variant="outline" onClick={() => { setEditingCategoryId(null); setCategoryName(""); }}>Cancel</Button>}</div></form>
      {categories.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading categories...</p> : categories.error ? <div role="alert" className="text-sm"><p>Couldn&apos;t load categories.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => categories.refetch()}>Try again</Button></div> : categories.data.length === 0 ? <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p> : <ul className="divide-y divide-border rounded-xl border border-border">{categories.data.map((category) => <li key={category.id} className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-sm font-medium">{category.name}</span><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); }}>Rename</Button><Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Remove ${category.name}? Products in this category will become uncategorized.`)) removeCategory.mutate(category.id); }} disabled={removeCategory.isPending}>Remove</Button></div></li>)}</ul>}
    </CardContent></Card>}

    {showForm && <Card className="mt-6"><CardHeader className="flex-row justify-between"><div><CardTitle>{editing ? "Edit product" : "Add a product"}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Initial stock is set to zero; use an adjustment to record an opening balance.</p></div><button type="button" onClick={() => { setShowForm(false); setEditing(null); }} aria-label="Close product form" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></CardHeader>
      <CardContent><form key={editing?.id ?? "new"} onSubmit={submitProduct} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium">Product name<input name="name" required maxLength={120} defaultValue={editing?.name ?? ""} className="form-input" /></label>
        <label className="text-sm font-medium">SKU<input name="sku" required maxLength={48} defaultValue={editing?.sku ?? ""} className="form-input" /></label>
        <label className="text-sm font-medium">Price ({currency})<input name="price" inputMode="decimal" required defaultValue={editing?.price ?? ""} className="form-input" placeholder="49.00" /></label>
        <label className="text-sm font-medium">Category<select name="categoryId" defaultValue={editing?.categoryId ?? ""} className="form-input"><option value="">Uncategorized</option>{categories.data?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label className="text-sm font-medium">Low-stock alert at<input name="lowStockAt" type="number" min={0} max={100000} required defaultValue={editing?.lowStockAt ?? 5} className="form-input" /></label>
        <label className="text-sm font-medium">Description<input name="description" maxLength={1000} defaultValue={editing?.description ?? ""} className="form-input" /></label>
        <div className="flex items-end gap-2"><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving..." : editing ? "Save changes" : "Create product"}</Button><Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button></div>
      </form></CardContent>
    </Card>}

    {adjusting && <Card className="mt-4"><CardHeader className="flex-row justify-between"><div><CardTitle>Adjust {adjusting.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Current stock: {adjusting.stock} · Negative adjustments are blocked below zero.</p></div><button type="button" aria-label="Close stock adjustment" onClick={() => setAdjusting(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></CardHeader><CardContent><form onSubmit={submitAdjustment} className="grid gap-4 sm:grid-cols-[180px_1fr_auto]"><label className="text-sm font-medium">Quantity change<input name="quantity" type="number" required step={1} min={-100000} max={100000} className="form-input" placeholder="e.g. 12 or -2" /></label><label className="text-sm font-medium">Reason<input name="reason" required minLength={3} maxLength={120} className="form-input" placeholder="Opening stock, damaged item..." /></label><Button type="submit" disabled={adjust.isPending} className="self-end">{adjust.isPending ? "Saving..." : "Save adjustment"}</Button></form></CardContent></Card>}

    <Card className="mt-6"><CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Catalog</CardTitle><p className="mt-1 text-xs text-muted-foreground">{products.data ? `${products.data.total} active products` : "Search and manage product records"}</p></div><label className="relative block w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Search products</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" placeholder="Search name, SKU or category" /></label></CardHeader><CardContent className="px-0 pt-0">
      {products.isPending ? <div role="status" className="space-y-3 px-5 py-5"><span className="sr-only">Loading products...</span>{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> :
      products.error ? <div role="alert" className="px-5 py-12 text-center"><p className="text-sm font-medium">Couldn&apos;t load products.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => products.refetch()}>Try again</Button></div> :
      products.data.items.length === 0 ? <div className="px-5 py-16 text-center"><Boxes className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">{deferredSearch ? "No matching products" : "No products yet"}</p><p className="mt-1 text-xs text-muted-foreground">{deferredSearch ? "Try another search." : "Add products to start tracking inventory."}</p>{canEdit && !deferredSearch && <Button size="sm" className="mt-4" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={15} /> Add product</Button>}</div> :
      <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-y border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Price</th><th className="px-4 py-3 font-medium">Stock</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-border">
        {products.data.items.map((product) => <tr key={product.id} className="hover:bg-muted/30"><td className="px-5 py-3.5"><p className="font-medium">{product.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{product.sku}</p></td><td className="px-4 py-3.5 text-muted-foreground">{product.category?.name ?? "Uncategorized"}</td><td className="px-4 py-3.5 font-medium">{formatCurrency(Number(product.price), currency)}</td><td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 ${product.stock <= product.lowStockAt ? "text-destructive" : ""}`}>{product.stock <= product.lowStockAt && <span className="size-1.5 rounded-full bg-destructive" />}{product.stock} <span className="text-xs text-muted-foreground">{product.stock <= product.lowStockAt ? "Low" : "in stock"}</span></span></td><td className="px-5 py-3.5"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setMovementProductId(movementProductId === product.id ? null : product.id)} aria-label={`View ${product.name} stock history`}><Activity size={14} /> History</Button>{canEdit && <><Button variant="ghost" size="sm" onClick={() => setAdjusting(product)}>Adjust stock</Button><Button variant="ghost" size="icon" aria-label={`Edit ${product.name}`} onClick={() => { setEditing(product); setShowForm(true); }}><Pencil size={15} /></Button><Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Archive ${product.name}?`)) archive.mutate(product.id); }} disabled={archive.isPending}>Archive</Button></>}</div></td></tr>)}
      </tbody></table></div>}
      {movementProductId && <div className="border-t border-border bg-muted/20 px-5 py-4"><h3 className="text-sm font-semibold">Inventory movements</h3>{movements.isPending ? <p role="status" className="mt-2 text-xs text-muted-foreground">Loading movements...</p> : movements.error ? <p role="alert" className="mt-2 text-xs text-destructive">Could not load movements.</p> : movements.data.length ? <div className="mt-3 space-y-2">{movements.data.map((movement) => <div className="flex justify-between gap-4 text-xs" key={movement.id}><span>{movement.reason} · {formatDate(movement.createdAt)}</span><span className={movement.quantity > 0 ? "text-primary" : "text-destructive"}>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</span></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">No movements recorded.</p>}</div>}
      {products.data && products.data.pages > 1 && <div className="flex items-center justify-between border-t border-border px-5 py-3"><p className="text-xs text-muted-foreground">Page {products.data.page} of {products.data.pages}</p><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}><ArrowLeft size={14} /> Previous</Button><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.min(products.data!.pages, value + 1))} disabled={page >= products.data.pages}>Next <ArrowRight size={14} /></Button></div></div>}
    </CardContent></Card>
  </div>;
}

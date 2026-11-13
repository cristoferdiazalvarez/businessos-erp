"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Boxes, ChevronDown, Command, FileText, LayoutDashboard, LogOut, Menu, Moon, ShoppingBag, Sun, UsersRound, X } from "lucide-react";
import { api, ApiError, type SessionUser } from "@/lib/api";
import { Button } from "@/components/ui/button";

function useTheme(preference: "light" | "dark") {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(preference);
    document.documentElement.dataset.theme = preference;
    window.localStorage.setItem("businessos-theme", preference);
  }, [preference]);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("businessos-theme", next);
    void api("/settings/preferences", { method: "PATCH", body: JSON.stringify({ theme: next }) })
      .catch(() => toast.error("Theme changed here, but couldn’t be synced to your account."));
  }
  return { theme, toggle };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: SessionUser }>("/auth/me"),
  });
  const { theme, toggle } = useTheme(session.data?.user.theme ?? "light");

  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, session.error]);

  async function logout() {
    try {
      await api<void>("/auth/logout", { method: "POST" });
      await queryClient.invalidateQueries();
      router.replace("/login");
    } catch {
      toast.error("Could not sign out. Please try again.");
    }
  }

  if (session.isPending || !session.data) {
    if (session.isPending || (session.error instanceof ApiError && session.error.status === 401)) {
      return <main className="grid min-h-screen place-items-center bg-background"><div role="status" className="flex items-center gap-3 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />Loading your workspace...</div></main>;
    }
    return <main className="grid min-h-screen place-items-center bg-background p-5"><section className="max-w-sm text-center"><h1 className="text-lg font-semibold">Workspace unavailable</h1><p className="mt-2 text-sm text-muted-foreground">We couldn&apos;t verify your session. Check the API connection and try again.</p><Button variant="outline" className="mt-5" onClick={() => session.refetch()}>Try again</Button></section></main>;
  }

  const user = session.data.user;
  const navItems = [
    { href: "/app", label: "Overview", icon: LayoutDashboard },
    { href: "/app/customers", label: "Customers", icon: UsersRound },
    { href: "/app/products", label: "Products & stock", icon: Boxes },
    { href: "/app/orders", label: "Sales", icon: ShoppingBag },
    { href: "/app/invoices", label: "Invoices", icon: FileText },
    { href: "/app/reports", label: "Reports", icon: Activity },
    { href: "/app/team", label: "Team", icon: UsersRound },
    { href: "/app/settings", label: "Settings", icon: Command },
    { href: "/app/audit", label: "Activity log", icon: Activity },
  ];
  const currentSection = navItems.find(item => item.href === pathname)?.label ?? "Workspace";
  return (
    <div className="min-h-screen bg-background">
      {menuOpen && <button className="fixed inset-0 z-30 bg-black/35 lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-border bg-card px-4 py-5 transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <Link href="/app" className="flex items-center gap-2.5 font-semibold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Command size={17} /></span><span>business<span className="font-normal text-muted-foreground">os</span></span></Link>
          <button onClick={() => setMenuOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-border p-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#e6f1e9] text-sm font-semibold text-primary dark:bg-secondary">{user.organizationName.slice(0, 1)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user.organizationName}</span><span className="mt-0.5 block text-xs text-muted-foreground">Workspace</span></span>
          <ChevronDown size={15} className="text-muted-foreground" />
        </div>
        <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[.15em] text-muted-foreground">Workspace</p>
        <nav aria-label="Workspace navigation" className="max-h-[45vh] space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon size={17} /> {label}</Link>;
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-[#f0f5f1] p-4 dark:bg-secondary">
            <div className="mb-2 flex items-center gap-2 text-primary"><Activity size={16} /><span className="text-xs font-semibold">Your workspace is live</span></div>
            <p className="text-xs leading-5 text-muted-foreground">Dashboard metrics are read from your organization&apos;s saved data.</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl p-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#dfebe2] text-xs font-semibold text-primary dark:bg-secondary">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.name}</span><span className="block text-xs capitalize text-muted-foreground">{user.role.toLowerCase()}</span></span>
            <button type="button" onClick={toggle} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
            <button type="button" onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span>Workspace</span><span>/</span><span className="font-medium text-foreground">{currentSection}</span></div>
            <span className="text-sm font-semibold sm:hidden">{currentSection}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground md:inline-flex">Demo workspace</span>
            <button type="button" onClick={toggle} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted sm:hidden">{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
            <div className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}

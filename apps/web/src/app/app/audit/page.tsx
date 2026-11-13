"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface AuditEvent {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

export default function AuditPage() {
  const events = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<{ items: AuditEvent[]; total: number }>("/audit?page=1&limit=50"),
  });

  return <div>
    <div><p className="text-xs font-medium text-muted-foreground">Workspace / Activity log</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Activity log</h1><p className="mt-2 text-sm text-muted-foreground">A tenant-scoped record of important workspace changes.</p></div>
    <Card className="mt-6"><CardHeader><CardTitle className="text-base">Recent events</CardTitle><p className="text-xs text-muted-foreground">{events.data ? `${events.data.total} saved events` : "Latest saved actions"}</p></CardHeader><CardContent className="px-0 pt-0">
      {events.isPending ? <div role="status" className="space-y-3 px-5 py-5"><span className="sr-only">Loading activity...</span>{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : events.error ? <div role="alert" className="px-5 py-12 text-center"><p className="text-sm font-medium">Activity log unavailable.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => events.refetch()}>Try again</Button></div> : events.data.items.length === 0 ? <div className="px-5 py-16 text-center"><Activity className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">No activity recorded yet</p><p className="mt-1 text-xs text-muted-foreground">Customer, inventory, order, and team changes will be recorded here.</p></div> : <div className="divide-y divide-border">{events.data.items.map((event) => <div key={event.id} className="flex items-start gap-3 px-5 py-4"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Activity size={15} /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{event.action.replaceAll(".", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{event.actor?.name ?? "Former member"} · {event.entity}{event.entityId ? ` · ${event.entityId.slice(0, 10)}` : ""}</p></div><time className="shrink-0 text-xs text-muted-foreground">{formatDate(event.createdAt)}</time></div>)}</div>}
    </CardContent></Card>
    <p className="mt-4 text-xs text-muted-foreground">Audit events intentionally omit password, session, and reset-token secrets.</p>
  </div>;
}

"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, MailPlus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface TeamMember {
  id: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  status: "ACTIVE" | "INVITED";
  invitedAt: string | null;
  joinedAt: string;
  user: { id: string; email: string; name: string };
}
interface InviteResult { email: string; demoInviteToken: string; demoOnly: boolean }

const invitationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email address").max(254),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]),
});
const teamRoleSchema = z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]);

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<{ user: { id: string; role: string } }>("/auth/me") });
  const canManage = Boolean(session.data && ["ADMIN", "MANAGER"].includes(session.data.user.role));
  const isAdmin = session.data?.user.role === "ADMIN";
  const members = useQuery({ queryKey: ["employees"], queryFn: () => api<TeamMember[]>("/employees") });
  const invite = useMutation({
    mutationFn: (data: z.infer<typeof invitationSchema>) =>
      api<InviteResult>("/employees/invitations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      setInviteToken(result.demoInviteToken);
      setInviteOpen(false);
      toast.success("Demo invitation created");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not invite this team member."),
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: TeamMember["role"] }) =>
      api(`/employees/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Team role updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not change this role."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/employees/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Workspace access removed");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not remove this member."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = invitationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget).entries()));
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the invitation details."); return; }
    invite.mutate(parsed.data);
  }

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-medium text-muted-foreground">Workspace / Team</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Team</h1><p className="mt-2 text-sm text-muted-foreground">Manage membership and role-based workspace access.</p></div>{canManage && <Button onClick={() => setInviteOpen((value) => !value)}><MailPlus size={16} /> Invite member</Button>}</div>
    {inviteToken && <Card className="mt-5 border-primary/30"><CardHeader><CardTitle className="text-base">One-time demo invitation token</CardTitle><p className="text-xs leading-5 text-muted-foreground">No email provider is configured. Share this token with the invited person through a secure channel. It expires in seven days and can be used once on the password reset page.</p></CardHeader><CardContent><div className="flex flex-col gap-3 sm:flex-row"><code className="min-w-0 flex-1 break-all rounded-lg bg-muted p-3 text-xs">{inviteToken}</code><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(inviteToken).then(() => toast.success("Token copied")).catch(() => toast.error("Clipboard access was denied.")); }}><Copy size={15} /> Copy token</Button><Button variant="ghost" onClick={() => setInviteToken("")}>Dismiss</Button></div></CardContent></Card>}
    {inviteOpen && <Card className="mt-5"><CardHeader><CardTitle>Invite to this workspace</CardTitle><p className="text-xs text-muted-foreground">A demo reset token will be generated locally instead of sending email.</p></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">Name<input name="name" required maxLength={120} className="form-input" /></label><label className="text-sm font-medium">Email<input name="email" type="email" required maxLength={254} className="form-input" /></label><label className="text-sm font-medium">Role<select name="role" defaultValue="EMPLOYEE" className="form-input">{isAdmin && <><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option></>}<option value="EMPLOYEE">Employee</option></select></label><div className="flex items-end gap-2"><Button type="submit" disabled={invite.isPending}>{invite.isPending ? "Creating..." : "Create invitation"}</Button><Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button></div></form></CardContent></Card>}
    <Card className="mt-6"><CardHeader><CardTitle className="text-base">Workspace members</CardTitle><p className="text-xs text-muted-foreground">{members.data ? `${members.data.length} people` : "Review workspace access"}</p></CardHeader><CardContent className="px-0 pt-0">
      {members.isPending ? <div role="status" className="space-y-3 px-5 py-5"><span className="sr-only">Loading team...</span>{[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : members.error ? <div role="alert" className="px-5 py-12 text-center"><p className="text-sm font-medium">Team details are unavailable.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => members.refetch()}>Try again</Button></div> : members.data.length === 0 ? <div className="px-5 py-16 text-center"><UsersRound className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">No members found</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-y border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Member</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Joined</th><th className="px-5 py-3 text-right font-medium">Access</th></tr></thead><tbody className="divide-y divide-border">{members.data.map((member) => <tr key={member.id}><td className="px-5 py-3.5"><p className="font-medium">{member.user.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{member.user.email}</p></td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${member.status === "ACTIVE" ? "bg-secondary text-secondary-foreground" : "bg-[#fbf0e2] text-[#a46c2c] dark:bg-[#403322]"}`}>{member.status.toLowerCase()}</span></td><td className="px-4 py-3.5">{isAdmin ? <label><span className="sr-only">Role for {member.user.name}</span><select value={member.role} onChange={(event) => { const result = teamRoleSchema.safeParse(event.target.value); if (result.success) changeRole.mutate({ id: member.id, role: result.data }); }} disabled={changeRole.isPending} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="EMPLOYEE">Employee</option></select></label> : <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck size={14} />{member.role.toLowerCase()}</span>}</td><td className="px-4 py-3.5 text-xs text-muted-foreground">{member.status === "INVITED" && member.invitedAt ? `Invited ${formatDate(member.invitedAt)}` : formatDate(member.joinedAt)}</td><td className="px-5 py-3.5 text-right">{isAdmin && member.user.id !== session.data?.user.id && <Button variant="ghost" size="icon" aria-label={`Remove ${member.user.name}`} onClick={() => { if (window.confirm(`Remove ${member.user.name} from this workspace?`)) remove.mutate(member.id); }} disabled={remove.isPending}><Trash2 size={15} /></Button>}</td></tr>)}</tbody></table></div>}
    </CardContent></Card>
    <p className="mt-5 text-xs leading-5 text-muted-foreground">Role checks are enforced by the API. Managers can invite employees; only admins can change roles or remove members.</p>
  </div>;
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, UserRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Settings {
  profile: { id: string; name: string; email: string; theme: "light" | "dark" };
  organization: { id: string; name: string; slug: string; currency: string; taxRate: string };
}
const profileSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(120) });
const organizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required").max(120),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  taxRate: z.string().regex(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/, "Enter a rate between 0 and 1"),
});

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<Settings>("/settings") });
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<{ user: { role: string } }>("/auth/me") });
  const isAdmin = session.data?.user.role === "ADMIN";
  const profile = useMutation({
    mutationFn: (data: z.infer<typeof profileSchema>) => api("/settings/profile", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update your profile."),
  });
  const organization = useMutation({
    mutationFn: (data: z.infer<typeof organizationSchema>) => api("/settings/organization", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Organization settings updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update organization settings."),
  });

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = profileSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget).entries()));
    if (!result.success) { toast.error(result.error.issues[0]?.message ?? "Check the form."); return; }
    profile.mutate(result.data);
  }
  function submitOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = organizationSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget).entries()));
    if (!result.success) { toast.error(result.error.issues[0]?.message ?? "Check the form."); return; }
    organization.mutate(result.data);
  }

  return <div>
    <div><p className="text-xs font-medium text-muted-foreground">Workspace / Settings</p><h1 className="mt-1 text-3xl font-semibold tracking-[-.04em]">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Manage your profile, organization, and business preferences.</p></div>
    {settings.isPending ? <div role="status" className="mt-6 space-y-4"><span className="sr-only">Loading settings...</span><div className="h-48 animate-pulse rounded-2xl bg-muted" /><div className="h-48 animate-pulse rounded-2xl bg-muted" /></div> : settings.error ? <div role="alert" className="mt-6 rounded-2xl border border-destructive/20 bg-card p-8 text-center"><p className="text-sm font-medium">Settings are unavailable.</p><Button variant="outline" className="mt-3" onClick={() => settings.refetch()}>Try again</Button></div> : <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <Card><CardHeader><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-secondary text-secondary-foreground"><UserRound size={17} /></span><div><CardTitle className="text-base">Your profile</CardTitle><p className="mt-1 text-xs text-muted-foreground">Personal information for this account</p></div></div></CardHeader><CardContent><form onSubmit={submitProfile} className="space-y-4"><label className="block text-sm font-medium">Full name<input name="name" required maxLength={120} defaultValue={settings.data.profile.name} className="form-input" /></label><label className="block text-sm font-medium">Email<input disabled value={settings.data.profile.email} className="form-input" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Email changes are disabled in this demo.</span></label><Button type="submit" disabled={profile.isPending}>{profile.isPending ? "Saving..." : "Save profile"}</Button></form></CardContent></Card>
      <Card><CardHeader><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#e8f4f6] text-[#438ba0] dark:bg-[#22383d]"><Building2 size={17} /></span><div><CardTitle className="text-base">Organization</CardTitle><p className="mt-1 text-xs text-muted-foreground">Workspace identity and default tax rate</p></div></div></CardHeader><CardContent>{isAdmin ? <form onSubmit={submitOrganization} className="space-y-4"><label className="block text-sm font-medium">Organization name<input name="name" required minLength={2} maxLength={120} defaultValue={settings.data.organization.name} className="form-input" /></label><label className="block text-sm font-medium">Currency code<input name="currency" required minLength={3} maxLength={3} defaultValue={settings.data.organization.currency} className="form-input uppercase" /></label><label className="block text-sm font-medium">Default tax rate<input name="taxRate" type="number" step="0.0001" min="0" max="1" defaultValue={settings.data.organization.taxRate} className="form-input" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Enter a fraction, for example 0.0825 for 8.25%. This is a demo setting, not a tax determination.</span></label><Button type="submit" disabled={organization.isPending}>{organization.isPending ? "Saving..." : "Save organization"}</Button></form> : <div className="space-y-3 text-sm"><p><span className="text-muted-foreground">Name:</span> {settings.data.organization.name}</p><p><span className="text-muted-foreground">Currency:</span> {settings.data.organization.currency}</p><p><span className="text-muted-foreground">Default tax rate:</span> {(Number(settings.data.organization.taxRate) * 100).toFixed(2)}%</p><p className="text-xs text-muted-foreground">Only an organization admin can change these settings.</p></div>}</CardContent></Card>
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Preferences</CardTitle><p className="text-xs text-muted-foreground">Use the theme toggle at the bottom of the navigation. Your choice is saved to your account.</p></CardHeader><CardContent><p className="text-sm">Current theme: <span className="font-semibold capitalize">{settings.data.profile.theme}</span></p></CardContent></Card>
    </div>}
    <p className="mt-5 text-xs text-muted-foreground">Organization tax preferences are configurable for the demo workflow and do not provide tax advice or compliance.</p>
  </div>;
}

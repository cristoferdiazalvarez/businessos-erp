"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

const forgotSchema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const [result, setResult] = useState("");
  const [token, setToken] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualReset, setManualReset] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const email = new FormData(event.currentTarget).get("email");
    const parsed = forgotSchema.safeParse({ email });
    if (!parsed.success) { setError("Enter a valid email address."); return; }
    setPending(true);
    try {
      const response = await api<{ message: string; demoResetToken?: string; demoOnly: boolean }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setResult(response.demoOnly ? "Demo reset link created. It is shown here only in development." : response.message);
      setToken(response.demoResetToken ?? "");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Unable to start password reset.");
    } finally {
      setPending(false);
    }
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (typeof data.password !== "string" || data.password.length < 12 || data.password !== data.confirm) {
      setError("Use a password of at least 12 characters and confirm it.");
      return;
    }

    setPending(true);
    try {
      await api<void>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: data.password }) });
      setToken("");
      setManualToken("");
      setManualReset(false);
      setResult("Password changed. You can now sign in with your new password.");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Unable to reset your password.");
    } finally {
      setPending(false);
    }
  }

  function useInvitationToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = manualToken.trim();
    if (value.length < 32 || value.length > 128) {
      setError("Enter the full invitation or reset token.");
      return;
    }
    setError("");
    setToken(value);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to sign in</Link>
        <span className="mb-5 grid size-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><KeyRound size={19} /></span>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">In this demo, reset instructions are generated locally. Production email delivery is not configured.</p>
        {!token && !manualReset ? (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label htmlFor="email" className="block text-sm font-medium">Work email<input id="email" name="email" type="email" required autoComplete="email" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" /></label>
            <Button className="w-full" disabled={pending}>{pending ? "Preparing..." : "Continue"}</Button>
            <button type="button" className="w-full pt-1 text-center text-xs font-medium text-primary hover:underline" onClick={() => { setManualReset(true); setResult(""); setError(""); }}>I have an invitation or reset token</button>
          </form>
        ) : !token ? (
          <form onSubmit={useInvitationToken} className="mt-7 space-y-4">
            <label className="block text-sm font-medium">Invitation or reset token<textarea value={manualToken} onChange={(event) => setManualToken(event.target.value)} required rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" /></label>
            <Button className="w-full" type="submit">Continue with token</Button>
            <button type="button" className="w-full pt-1 text-center text-xs font-medium text-primary hover:underline" onClick={() => { setManualReset(false); setError(""); }}>Request a new demo reset token</button>
          </form>
        ) : (
          <form onSubmit={reset} className="mt-7 space-y-4">
            <label className="block text-sm font-medium">New password<input name="password" type="password" minLength={12} required autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" /></label>
            <label className="block text-sm font-medium">Confirm password<input name="confirm" type="password" minLength={12} required autoComplete="new-password" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" /></label>
            <Button className="w-full" disabled={pending}>{pending ? "Updating..." : "Update password"}</Button>
          </form>
        )}
        {result && <p role="status" className="mt-4 rounded-xl border border-primary/20 bg-secondary px-3 py-2.5 text-sm text-secondary-foreground">{result}{token && <span className="mt-2 block break-all font-mono text-[11px]">Demo token: {token}</span>}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}

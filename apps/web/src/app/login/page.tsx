"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError, type SessionUser } from "@/lib/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const publicDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  async function exploreDemo() {
    setPending(true);
    setFormError("");
    try {
      await api("/auth/demo", { method: "POST" });
      router.replace("/app");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Demo access is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFormError("Enter a valid email address and password.");
      return;
    }

    setPending(true);
    try {
      await api<{ user: SessionUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Welcome back");
      router.replace("/app");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Unable to sign in right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_.95fr]">
      <section className="page-shell relative hidden overflow-hidden border-r border-border p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <Link href="/" className="flex w-fit items-center gap-2.5 font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={17} /></span>business<span className="font-normal text-muted-foreground">os</span></Link>
        <div className="relative z-10 max-w-xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-primary">A little more clarity</p>
          <h2 className="text-5xl font-semibold leading-[1.08] tracking-[-.055em] xl:text-6xl">Bring your good work into focus.</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Your customers, products, and orders are ready when you are.</p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card/80 p-4"><span className="text-xs text-muted-foreground">One place for the details</span><p className="mt-2 text-sm font-semibold">A clearer view of your business</p></div>
            <div className="rounded-2xl border border-border bg-card/80 p-4"><span className="text-xs text-muted-foreground">Made for your team</span><p className="mt-2 text-sm font-semibold">Built to move together</p></div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Northstar Studio demo workspace · Fictional sample data</p>
        <div className="absolute -bottom-36 -right-24 size-[420px] rounded-full border border-primary/10" /><div className="absolute -bottom-24 -right-12 size-[300px] rounded-full border border-primary/10" />
      </section>
      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden"><ArrowLeft size={16} /> BusinessOS</Link>
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-12">
          <div className="mb-8">
            <span className="mb-6 grid size-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Sparkles size={19} /></span>
            <h1 className="text-3xl font-semibold tracking-[-.04em]">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your BusinessOS workspace.</p>
          </div>
          <form onSubmit={submit} className="space-y-5" noValidate>
            {publicDemo && <div className="space-y-3 rounded-xl border border-border bg-muted/60 p-4"><p className="text-sm text-muted-foreground">Explore the workspace with fictional data and read-only access. No password needed.</p><Button type="button" className="w-full" disabled={pending} onClick={exploreDemo}>Explore demo <ArrowRight size={16} /></Button></div>}
            <label className="block text-sm font-medium" htmlFor="email">Work email
              <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" placeholder="you@company.com" />
            </label>
            <label className="block text-sm font-medium" htmlFor="password">Password
              <span className="relative mt-2 block">
                <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="h-11 w-full rounded-xl border border-border bg-card px-3.5 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20" placeholder="Enter your password" />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </span>
            </label>
            {formError && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{formError}</p>}
            <Button className="w-full" disabled={pending}>{pending ? "Signing in..." : "Sign in"} {!pending && <ArrowRight size={16} />}</Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted-foreground">Need a fresh start? <Link href="/forgot-password" className="font-medium text-primary hover:underline">Reset your password</Link></div>
          <div className="mt-8 rounded-xl border border-border bg-muted/60 p-4 text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">Demo accounts</p>
            <p className="mt-1">admin@businessos.demo · manager@businessos.demo · employee@businessos.demo</p>
            <p className="mt-1">{publicDemo ? "Demo sessions expire after one hour. Administrative actions and changes to data are disabled." : "Set your own passwords in `.env` before running the demo seed. No shared credentials are provided."}</p>
          </div>
        </div>
        <p className="pb-2 text-center text-xs text-muted-foreground">By signing in, you agree to keep your workspace secure.</p>
      </section>
    </main>
  );
}

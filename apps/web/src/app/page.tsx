import Link from "next/link";
import { ArrowDownRight, ArrowRight, BarChart3, Boxes, Check, CircleDollarSign, MoveUpRight, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const capabilities = [
  { icon: CircleDollarSign, title: "Know what moves", text: "Sales, cash flow, and customer signals in one clear view." },
  { icon: Boxes, title: "Keep things in rhythm", text: "Products and stock stay connected to every order." },
  { icon: BarChart3, title: "Make the next call", text: "Turn everyday activity into a calmer plan for growth." },
];

export default function HomePage() {
  return (
    <main className="page-shell min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="BusinessOS home">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={17} /></span>
          <span className="text-[17px]">business<span className="font-normal text-muted-foreground">os</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
          <a href="#why-businessos" className="transition-colors hover:text-foreground">Why BusinessOS</a>
          <a href="#built-for-focus" className="transition-colors hover:text-foreground">Built for focus</a>
          <Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link>
        </nav>
        <Link href="/login"><Button size="sm" className="rounded-full px-4">Open workspace <ArrowRight size={15} /></Button></Link>
      </header>

      <section className="soft-grid relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-16 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:pb-28 md:pt-20">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-secondary-foreground shadow-sm">
            <span className="size-1.5 rounded-full bg-primary" /> Less busywork. Better business.
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.06] tracking-[-.055em] sm:text-6xl lg:text-[4.6rem]">
            Your whole business, <span className="text-primary">in good hands.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
            A thoughtful workspace for the details behind your next big move. Bring customers, orders, stock, and insight into one clear picture.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login"><Button size="lg" className="rounded-full px-6">Explore the workspace <MoveUpRight size={17} /></Button></Link>
            <a href="#why-businessos" className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-medium hover:bg-muted">See what fits <ArrowDownRight size={16} /></a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["One connected workspace", "Built for growing teams", "Your data stays yours"].map((item) => <span className="inline-flex items-center gap-1.5" key={item}><Check size={14} className="text-primary" />{item}</span>)}
          </div>
        </div>

        <div className="relative mx-auto grid min-h-[420px] w-full max-w-[540px] place-items-center">
          <div className="absolute size-[380px] rounded-full border border-primary/10 sm:size-[440px]" />
          <div className="absolute size-[270px] rounded-full border border-primary/10 sm:size-[320px]" />
          <div className="absolute size-[160px] rounded-full bg-[#dfeee4] blur-3xl dark:bg-[#1c4833]" />
          <div className="relative z-10 grid size-32 place-items-center rounded-[28px] border border-border bg-card text-center shadow-[0_25px_60px_-25px_rgba(27,65,46,.32)] sm:size-36">
            <div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles size={18} /></span><p className="mt-2 text-xs font-semibold">One workspace</p><p className="mt-1 text-[10px] text-muted-foreground">BusinessOS</p></div>
          </div>
          <div className="absolute left-[3%] top-[15%] z-10 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:left-[7%]"><span className="grid size-9 place-items-center rounded-xl bg-secondary text-secondary-foreground"><UsersRound size={17} /></span><span><b className="block text-xs font-semibold">Customers</b><small className="text-[10px] text-muted-foreground">Relationships</small></span></div>
          <div className="absolute right-[1%] top-[22%] z-10 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:right-[4%]"><span className="grid size-9 place-items-center rounded-xl bg-[#f7efe3] text-[#a46c2c] dark:bg-[#403322]"><CircleDollarSign size={17} /></span><span><b className="block text-xs font-semibold">Sales</b><small className="text-[10px] text-muted-foreground">Orders & invoices</small></span></div>
          <div className="absolute bottom-[18%] left-[5%] z-10 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:left-[9%]"><span className="grid size-9 place-items-center rounded-xl bg-[#e8f4f6] text-[#438ba0] dark:bg-[#22383d]"><Boxes size={17} /></span><span><b className="block text-xs font-semibold">Inventory</b><small className="text-[10px] text-muted-foreground">Products & stock</small></span></div>
          <div className="absolute bottom-[10%] right-[2%] z-10 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:right-[7%]"><span className="grid size-9 place-items-center rounded-xl bg-[#f0ecfa] text-[#7f64bd] dark:bg-[#302a40]"><BarChart3 size={17} /></span><span><b className="block text-xs font-semibold">Insight</b><small className="text-[10px] text-muted-foreground">Your business view</small></span></div>
        </div>
      </section>

      <section id="why-businessos" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
        <div className="grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-end">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-primary">Room to think</p><h2 className="max-w-md text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Less time stitching things together.</h2></div>
          <p className="max-w-xl pb-1 text-sm leading-6 text-muted-foreground md:justify-self-end">The work behind a growing business can feel scattered. BusinessOS brings the important pieces closer so your team can spend more energy on the work that matters.</p>
        </div>
        <div id="built-for-focus" className="mt-10 grid gap-4 md:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, text }, index) => <article key={title} className="rounded-2xl border border-border bg-card p-6">
            <div className={`mb-7 grid size-11 place-items-center rounded-2xl ${index === 1 ? "bg-secondary text-secondary-foreground" : "bg-[#edf4ef] text-primary dark:bg-secondary"}`}><Icon size={20} /></div>
            <h3 className="text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
          </article>)}
        </div>
      </section>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© 2026 BusinessOS · A demo workspace for growing teams.</span><span>Fictional demo data. Invoices are not tax or legal documents.</span></div>
      </footer>
    </main>
  );
}

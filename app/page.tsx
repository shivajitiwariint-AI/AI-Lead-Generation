import Link from "next/link";
import { AiBackground } from "@/components/ai-background";
import { PublicChat } from "@/components/public-chat";
import { prisma } from "@/lib/prisma";
import {
  Sparkles,
  Bot,
  LineChart,
  CalendarCheck,
  ShieldCheck,
  Users,
  ArrowRight,
  Zap,
  Target,
  Mail,
  MessageCircle,
  CheckCircle2,
  Globe,
} from "lucide-react";

// Always render with fresh, real database counts (no cached marketing numbers)
export const dynamic = "force-dynamic";

const QUALIFIED_STATUSES = ["qualified", "contacted", "meeting_scheduled", "proposal", "won"];

/** Real platform-wide aggregate counts (no tenant data or PII exposed). */
async function getLiveStats() {
  try {
    const [totalLeads, qualifiedLeads, emailsDrafted, meetingsBooked, pendingApprovals, emailedPending] =
      await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { status: { in: QUALIFIED_STATUSES } } }),
        prisma.message.count({ where: { channel: "email" } }),
        prisma.meeting.count(),
        prisma.approvalItem.count({ where: { status: "pending" } }),
        prisma.message.count({ where: { channel: "email", status: "pending_review" } }),
      ]);
    return { totalLeads, qualifiedLeads, emailsDrafted, meetingsBooked, pendingApprovals, emailedPending };
  } catch {
    return { totalLeads: 0, qualifiedLeads: 0, emailsDrafted: 0, meetingsBooked: 0, pendingApprovals: 0, emailedPending: 0 };
  }
}

const features = [
  {
    icon: Sparkles,
    title: "AI Lead Scoring",
    description:
      "Every enquiry scored against your ideal customer profile — your team works the hottest leads first.",
    glow: "from-indigo-500/20 to-purple-500/20",
  },
  {
    icon: Bot,
    title: "Website Chatbot",
    description:
      "Qualify visitors 24/7, capture contact details and hand over structured leads automatically.",
    glow: "from-cyan-500/20 to-blue-500/20",
  },
  {
    icon: LineChart,
    title: "Pipeline Visibility",
    description:
      "Track every stage from first touch to won with a live pipeline and conversion reporting.",
    glow: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: CalendarCheck,
    title: "Automated Follow-ups",
    description:
      "Never let a lead go cold — smart reminders and multi-channel follow-up sequences.",
    glow: "from-amber-500/20 to-orange-500/20",
  },
  {
    icon: Users,
    title: "Multi-tenant Teams",
    description:
      "Roles and permissions for owners, managers and reps, every workspace fully isolated.",
    glow: "from-pink-500/20 to-rose-500/20",
  },
  {
    icon: ShieldCheck,
    title: "Audit & Compliance",
    description:
      "Encrypted credentials, full audit logs and consent tracking built into every action.",
    glow: "from-violet-500/20 to-indigo-500/20",
  },
];

const steps = [
  { step: "01", title: "Capture", text: "Forms, CSV imports, chatbot and API in one place." },
  { step: "02", title: "Qualify", text: "AI scoring and requirements matching rank every lead." },
  { step: "03", title: "Engage", text: "Campaigns and follow-ups move leads toward a decision." },
];

export default async function LandingPage() {
  const stats = await getLiveStats();
  const fmt = (n: number) => n.toLocaleString("en-US");
  const liveCards = [
    { label: "Leads qualified", value: fmt(stats.qualifiedLeads), color: "text-cyan-400" },
    { label: "Emails drafted", value: fmt(stats.emailsDrafted), color: "text-indigo-400" },
    { label: "Meetings booked", value: fmt(stats.meetingsBooked), color: "text-emerald-400" },
  ];
  const bottomStats = [
    { value: fmt(stats.totalLeads), label: "Total leads in pipeline" },
    { value: fmt(stats.qualifiedLeads), label: "Qualified leads" },
    { value: fmt(stats.emailsDrafted), label: "Emails drafted" },
    { value: fmt(stats.meetingsBooked), label: "Meetings booked" },
  ];
  const aiLine =
    stats.emailedPending > 0
      ? `${stats.emailedPending} email(s) awaiting approval`
      : stats.pendingApprovals > 0
        ? `${stats.pendingApprovals} item(s) awaiting approval`
        : `${fmt(stats.qualifiedLeads)} qualified lead(s) · ${fmt(stats.emailsDrafted)} email(s) drafted · ${fmt(stats.meetingsBooked)} meeting(s) booked`;
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <AiBackground />
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-[#050816]/70 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            <span className="text-lg font-semibold tracking-tight">AI Lead Gen</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 sm:inline-flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              AI live
            </span>
            <Link
              href="/auth/signin"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero */}
        <section className="relative px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="container mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur">
              <Zap className="h-3.5 w-3.5 text-cyan-400" />
              Multi-tenant AI sales automation
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Your AI{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_200%]">
                sells while you sleep
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60 md:text-xl">
              Capture, score, match and engage leads with an autonomous AI agent —
              fully automated, human-approved, or manual. You choose the mode.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/signup"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 hover:shadow-indigo-500/50"
              >
                Start free trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-sm text-white/40">
              Free for your first workspace — sign up to start, or sign in with your account.
            </p>

            {/* Live workspace — real database counts, updated on every visit */}
            <div className="relative mx-auto mt-16 max-w-4xl">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500/40 via-cyan-400/40 to-purple-500/40 blur-xl opacity-60" />
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-500/80" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="ml-2 text-xs text-white/50">AI Lead Gen · Live workspace</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    AI running
                  </span>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-3">
                  {liveCards.map((s, i) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 text-left animate-fade-up"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <p className="text-xs text-white/50">{s.label}</p>
                      <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="mt-1 text-xs text-emerald-400">live from database</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Bot className="h-5 w-5 text-cyan-400" />
                    <div className="flex-1">
                      <p className="text-white/80">
                        <span className="text-cyan-400">AI:</span> {aiLine}
                      </p>
                    </div>
                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform stats — real database counts */}
        <section className="border-y border-white/10 bg-white/[0.02] px-6 py-12">
          <div className="container mx-auto grid grid-cols-2 gap-6 md:grid-cols-4">
            {bottomStats.map((s, i) => (
              <div
                key={s.label}
                className="text-center animate-fade-up"
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
              >
                <p className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent md:text-4xl">
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20">
          <div className="container mx-auto">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Everything your sales team needs
              </h2>
              <p className="mt-3 text-white/60">
                From first click to closed deal — built for teams that outgrew spreadsheets.
              </p>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08] animate-fade-up"
                    style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                  >
                    <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${f.glow} blur-2xl transition-opacity group-hover:opacity-100 opacity-60`} />
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/10">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="relative mt-4 text-base font-semibold">{f.title}</h3>
                    <p className="relative mt-2 text-sm leading-relaxed text-white/60">
                      {f.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-white/10 bg-white/[0.02] px-6 py-20">
          <div className="container mx-auto">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
              <p className="mt-3 text-white/60">Three steps to a healthier pipeline.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <div
                  key={s.step}
                  className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur animate-fade-up"
                  style={{ animationDelay: `${0.1 + i * 0.1}s` }}
                >
                  <span className="text-4xl font-bold bg-gradient-to-br from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    {s.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-white/60">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-16 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 p-8 text-center shadow-2xl shadow-indigo-500/30 animate-pulse-glow">
              <h3 className="text-2xl font-bold">Ready to see it in action?</h3>
              <p className="mt-2 text-sm text-white/80">
                Sign in to your workspace and explore the full AI automation product.
              </p>
              <Link
                href="/auth/signin"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-600 transition-transform hover:scale-105"
              >
                Open workspace <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050816] py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400">
              <ShieldCheck className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-sm font-medium">AI Lead Gen</span>
          </div>
          <p className="text-sm text-white/40">AI Lead Generation &amp; Sales Automation SaaS</p>
          <div className="flex items-center gap-4 text-sm text-white/50">
            <Link href="/auth/signin" className="hover:text-white">Sign in</Link>
            <Link href="/auth/signup" className="hover:text-white">Get started</Link>
          </div>
        </div>
      </footer>
      <PublicChat />
    </div>
  );
}

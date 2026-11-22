import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Building,
  CalendarDays,
  Circle,
  Clock,
  Edit,
  Globe,
  Hand,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
  StickyNote,
  Target,
  User,
} from "lucide-react";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/copy-button";
import { DeleteLeadButton } from "@/components/delete-lead-button";
import { LeadEmailOutreach } from "@/components/lead-email-outreach";
import { LeadNoteComposer } from "@/components/lead-note-composer";
import { LeadOwnerAssign } from "@/components/lead-owner-assign";
import { LeadStatusSelect } from "@/components/lead-status-select";
import { LeadTakeoverToggle } from "@/components/lead-takeover-toggle";
import { RunQualificationButton } from "@/components/run-qualification-button";
import { cn } from "@/lib/utils";
import { formatIndustry } from "@/lib/industry";
import { leadStatusLabel } from "@/lib/lead-status";
import { sanitizeMessageForClient } from "@/lib/email-attachments";
import {
  activityFullTime,
  activityRelativeTime,
  describeActivity,
  type ActivityCategory,
} from "@/lib/activity-format";

const ACTIVITY_STYLE: Record<
  ActivityCategory,
  { icon: LucideIcon; className: string }
> = {
  email: { icon: Mail, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  meeting: {
    icon: CalendarDays,
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  followup: { icon: Clock, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  status: {
    icon: RefreshCw,
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  ai: {
    icon: Sparkles,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  control: {
    icon: Hand,
    className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  note: { icon: StickyNote, className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  other: { icon: Circle, className: "bg-muted text-muted-foreground" },
};

function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 min-w-0 text-sm">{children}</div>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color =
    clamped >= 70 ? "bg-emerald-500" : clamped >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{clamped}/100</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
      >
        <div className={cn("h-full rounded-full", color)} style={{ width: `${clamped}%` }} />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function sourceLabel(type?: string | null) {
  if (!type) return "Added manually";
  const labels: Record<string, string> = {
    research: "AI research",
    search: "Web search",
    website: "Website",
    social: "Social",
    import: "Import",
    api: "API",
    manual: "Added manually",
  };
  return labels[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getAuthContext();

  const leadWhere: any = { id: params.id };
  if (!ctx.isSuperAdmin && ctx.tenantId) {
    leadWhere.tenantId = ctx.tenantId;
  }
  const lead = await prisma.lead.findFirst({ where: leadWhere });
  if (!lead) notFound();

  const [activities, qualification, emails, source] = await Promise.all([
    prisma.leadActivity.findMany({
      where: { leadId: params.id, tenantId: lead.tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.leadQualificationResult.findFirst({
      where: { leadId: params.id, tenantId: lead.tenantId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findMany({
      where: { leadId: params.id, tenantId: lead.tenantId, channel: "email" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.leadSource.findFirst({
      where: { leadId: params.id, tenantId: lead.tenantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const [owner, members] = await Promise.all([
    lead.ownerId
      ? prisma.user.findUnique({
          where: { id: lead.ownerId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    (async () => {
      const memberships = await prisma.tenantUser.findMany({
        where: { tenantId: lead.tenantId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      const users = await prisma.user.findMany({
        where: { id: { in: memberships.map((m) => m.userId) } },
        select: { id: true, name: true, email: true },
      });
      const order = new Map(memberships.map((m, index) => [m.userId, index]));
      users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      return users;
    })(),
  ]);

  const userNames = new Map<string, string>();
  for (const member of members) userNames.set(member.id, member.name ?? member.email);
  if (owner && !userNames.has(owner.id)) {
    userNames.set(owner.id, owner.name ?? owner.email);
  }

  const initials = lead.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const headerFacts = [
    lead.company,
    formatIndustry(lead.industry) !== "—" ? formatIndustry(lead.industry) : null,
    lead.location,
  ].filter(Boolean);

  const serializedEmails = emails.map((email) => {
    const safe = sanitizeMessageForClient(email);
    return {
      id: safe.id,
      subject: safe.subject ?? "",
      body: safe.body ?? "",
      status: safe.status,
      toAddress: safe.toAddress ?? null,
      createdAt: safe.createdAt.toISOString(),
      sentAt: safe.sentAt ? safe.sentAt.toISOString() : null,
      meta: (safe.meta ?? {}) as Record<string, any>,
    };
  });

  const score = Math.max(0, Math.min(100, lead.score));
  const scoreColor =
    score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-slate-400";

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/leads" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Leads
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{lead.name}</span>
      </nav>

      <header className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{lead.name}</h1>
                <LeadStatusSelect leadId={lead.id} status={lead.status} />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {headerFacts.length ? headerFacts.join(" · ") : "No company details yet"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Target className="h-3 w-3" /> Score {lead.score}/100
                </Badge>
                <Badge variant={lead.consentMarketing ? "secondary" : "outline"}>
                  {lead.consentMarketing ? "Marketing consent recorded" : "No marketing consent"}
                </Badge>
                {lead.controlMode === "manual" && (
                  <Badge variant="outline" className="gap-1">
                    <Hand className="h-3 w-3" /> You are handling this lead
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href="#email-outreach">
                <Mail className="mr-2 h-4 w-4" /> Write email
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/leads/${lead.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit lead
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/leads/${lead.id}/followup`}>
                <CalendarDays className="mr-2 h-4 w-4" /> Follow-up
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Contact details</CardTitle>
              <CardDescription>Everything you know about this lead.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <DetailItem icon={Mail} label="Email">
                {lead.email ? (
                  <div className="flex items-center gap-1">
                    <a
                      href={`mailto:${lead.email}`}
                      className="min-w-0 truncate text-primary hover:underline"
                    >
                      {lead.email}
                    </a>
                    <CopyButton value={lead.email} label="Copy email" />
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </DetailItem>

              <DetailItem icon={Phone} label="Phone">
                {lead.phone ? (
                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:${lead.phone}`}
                      className="min-w-0 truncate text-primary hover:underline"
                    >
                      {lead.phone}
                    </a>
                    <CopyButton value={lead.phone} label="Copy phone" />
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </DetailItem>

              <DetailItem icon={Building} label="Company">
                {lead.company || <span className="text-muted-foreground">Not provided</span>}
              </DetailItem>

              <DetailItem icon={Globe} label="Website">
                {lead.website ? (
                  <div className="flex items-center gap-1">
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 truncate text-primary hover:underline"
                    >
                      {lead.website}
                    </a>
                    <CopyButton value={lead.website} label="Copy website" />
                  </div>
                ) : (
                  <span className="text-muted-foreground">Not provided</span>
                )}
              </DetailItem>

              <DetailItem icon={MapPin} label="Location">
                {lead.location || <span className="text-muted-foreground">Not provided</span>}
              </DetailItem>

              <DetailItem icon={Target} label="Industry">
                {formatIndustry(lead.industry)}
              </DetailItem>

              {lead.requirement && (
                <div className="sm:col-span-2">
                  <Separator className="mb-4" />
                  <h3 className="text-sm font-semibold">What they need</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {lead.requirement}
                  </p>
                </div>
              )}

              {lead.aiSummary && (
                <div className="sm:col-span-2">
                  <Separator className="mb-4" />
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" /> AI summary
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {lead.aiSummary}
                  </p>
                </div>
              )}

              {source?.sourceType === "research" && (
                <div className="sm:col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    AI-researched prospect — verify before outreach
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    This lead was generated from your target criteria. The name, email, phone and
                    company are plausible but not verified against an external source.
                    {lead.consentMarketing
                      ? " Marketing consent is recorded on this lead."
                      : " No marketing consent has been captured — confirm you have permission before sending real email."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="email-outreach" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" /> Email outreach
              </CardTitle>
              <CardDescription>
                Write with AI, review and personalise, then approve and send — all on this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadEmailOutreach
                leadId={lead.id}
                hasEmail={Boolean(lead.email)}
                initialEmails={serializedEmails}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity</CardTitle>
              <CardDescription>Notes, emails and AI actions for this lead.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LeadNoteComposer leadId={lead.id} />

              {activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => {
                    const info = describeActivity(
                      activity.activityType,
                      activity.payload,
                      (id) => userNames.get(id)
                    );
                    const style = ACTIVITY_STYLE[info.category];
                    const Icon = style.icon;
                    const actor = activity.actorId ? userNames.get(activity.actorId) : undefined;
                    const relative = activityRelativeTime(activity.createdAt);
                    const full = activityFullTime(activity.createdAt);
                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            style.className
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">{info.title}</p>
                            <time
                              className="text-xs text-muted-foreground"
                              title={full}
                              dateTime={new Date(activity.createdAt).toISOString()}
                            >
                              {relative}
                            </time>
                          </div>
                          {info.description && (
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                              {info.description}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {actor ? `${actor} · ${full}` : full}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No activity yet. Add a note above to start the timeline.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Lead snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Lead score</span>
                  <span className="font-semibold">{lead.score}/100</span>
                </div>
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Lead score"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={score}
                >
                  <div
                    className={cn("h-full rounded-full", scoreColor)}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Higher scores are more likely to convert.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-0.5 font-medium">{leadStatusLabel(lead.status)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</p>
                  <p className="mt-0.5 font-medium">{sourceLabel(source?.sourceType)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Created</p>
                  <p className="mt-0.5 font-medium">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Last contacted
                  </p>
                  <p className="mt-0.5 font-medium">
                    {lead.lastContactedAt
                      ? new Date(lead.lastContactedAt).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Marketing consent</p>
                  <Badge variant={lead.consentMarketing ? "secondary" : "outline"}>
                    {lead.consentMarketing ? "Recorded" : "Not recorded"}
                  </Badge>
                </div>
                {lead.consentMarketing ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lead.consentCapturedAt
                      ? `Captured ${new Date(lead.consentCapturedAt).toLocaleDateString()}`
                      : "Consent is recorded"}
                    {lead.consentMethod ? ` via ${lead.consentMethod}` : ""}.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Confirm you have permission before sending real email.
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Owner</p>
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-1.5">
                  <LeadOwnerAssign
                    leadId={lead.id}
                    ownerId={lead.ownerId ?? null}
                    ownerName={owner?.name ?? owner?.email ?? null}
                    ownerEmail={owner?.email ?? null}
                    members={members}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">AI handling</p>
                  <Badge variant="outline">
                    {lead.controlMode === "manual" ? "Manual" : "AI active"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lead.controlMode === "manual"
                    ? "You are handling this lead. AI follow-ups are paused."
                    : "AI can follow up automatically until you take over."}
                </p>
                <LeadTakeoverToggle leadId={lead.id} initialMode={lead.controlMode} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
              <div>
                <CardTitle className="text-lg">AI qualification</CardTitle>
                <CardDescription>How well this lead matches your offer.</CardDescription>
              </div>
              <RunQualificationButton leadId={lead.id} hasQualification={Boolean(qualification)} />
            </CardHeader>
            <CardContent>
              {qualification ? (
                <div className="space-y-4">
                  {qualification.nextAction && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                        <Sparkles className="h-3.5 w-3.5" /> Recommended next step
                      </p>
                      <p className="mt-1 text-sm font-medium">{qualification.nextAction}</p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ScoreBar
                      label="Fit"
                      value={qualification.fitScore}
                      hint="How closely they match your offer"
                    />
                    <ScoreBar
                      label="Interest"
                      value={qualification.intentScore}
                      hint="How ready they seem to talk"
                    />
                    <ScoreBar
                      label="Urgency"
                      value={qualification.urgencyScore}
                      hint="How soon they may need help"
                    />
                    <ScoreBar
                      label="Info completeness"
                      value={qualification.completenessScore}
                      hint="How much detail you have"
                    />
                  </div>

                  {qualification.summary && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">What AI thinks</p>
                      <p className="mt-1 text-sm text-muted-foreground">{qualification.summary}</p>
                    </div>
                  )}

                  {Array.isArray((qualification as any).matchedOffers) &&
                    ((qualification as any).matchedOffers as any[]).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Matched offers</p>
                        <ul className="mt-1.5 space-y-2">
                          {((qualification as any).matchedOffers as any[])
                            .slice(0, 5)
                            .map((match: any, index: number) => (
                              <li
                                key={index}
                                className="rounded-lg border border-border p-3 text-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{match.offer}</span>
                                  <Badge variant="secondary">{match.score}/100</Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{match.reason}</p>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                  {typeof (qualification as any).matchScore === "number" && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Overall match</span>
                      <span className="font-semibold">{(qualification as any).matchScore}/100</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="mt-2 text-sm font-medium">Not scored yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Run an AI check to see how well this lead fits your offer.
                  </p>
                  <div className="mt-3">
                    <RunQualificationButton leadId={lead.id} hasQualification={false} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Deleting this lead removes its emails and activity. This cannot be undone.
              </p>
              <DeleteLeadButton leadId={lead.id} name={lead.name} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

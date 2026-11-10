import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/link";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Cpu,
  ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue/10 text-blue" },
  { id: "qualified", label: "Qualified", color: "bg-green/10 text-green" },
  { id: "contacted", label: "Contacted", color: "bg-purple/10 text-purple" },
  { id: "meeting_scheduled", label: "Meeting Scheduled", color: "bg-indigo/10 text-indigo" },
  { id: "won", label: "Won", color: "bg-emerald/10 text-emerald" },
  { id: "lost", label: "Lost", color: "bg-red/10 text-red" },
  { id: "disqualified", label: "Disqualified", color: "bg-gray/10 text-gray" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  research: "AI Research",
  website: "Website Forms",
  csv: "CSV Import",
  whatsapp: "WhatsApp",
  email: "Email",
  manual: "Manual",
  referral: "Referral",
  other: "Other",
};

export default async function DashboardPage() {
  const ctx = await getAuthContext();

  if (ctx.isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">No workspace selected.</p>
      </div>
    );
  }

  return <ClientDashboard tenantId={tenantId} />;
}

async function ClientDashboard({ tenantId }: { tenantId: string }) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    totalLeads,
    newThisWeek,
    qualifiedCount,
    openOpportunities,
    bouncedEmails,
    stageCountsRaw,
    recentLeads,
    sourceCountsRaw,
    followups,
  ] = await Promise.all([
    prisma.lead.count({ where: { tenantId } }),
    prisma.lead.count({ where: { tenantId, createdAt: { gte: weekStart } } }),
    prisma.lead.count({ where: { tenantId, status: "qualified" } }),
    prisma.lead.count({
      where: { tenantId, status: { in: ["qualified", "contacted", "meeting_scheduled"] } },
    }),
    prisma.message.count({ where: { tenantId, status: "bounced" } }),
    prisma.lead.groupBy({ by: ["status"], where: { tenantId }, _count: { status: true } }),
    prisma.lead.findMany({
      where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.leadSource.groupBy({ by: ["sourceType"], where: { tenantId }, _count: { id: true } }),
    prisma.followupTask.findMany({
      where: { tenantId, status: "pending" },
      orderBy: { dueAt: "asc" },
      take: 5,
      select: { id: true, leadId: true, dueAt: true },
    }),
  ]);

  // Follow-ups with lead names/industries
  const leadIds = followups.map((f) => f.leadId);
  const followupLeads = leadIds.length
    ? await prisma.lead.findMany({ where: { id: { in: leadIds }, tenantId }, select: { id: true, name: true, industry: true } })
    : [];
  const leadById = new Map(followupLeads.map((l) => [l.id, l]));

  // Lead trend buckets (10 buckets of ~3 days)
  const BUCKETS = 10;
  const trend = Array.from({ length: BUCKETS }, () => 0);
  for (const l of recentLeads) {
    const daysAgo = Math.floor((now.getTime() - new Date(l.createdAt).getTime()) / 86400000);
    const idx = Math.min(BUCKETS - 1, Math.floor(daysAgo / 3));
    trend[BUCKETS - 1 - idx] += 1;
  }
  const trendMax = Math.max(1, ...trend);

  // Pipeline stage counts
  const stageCounts = new Map(stageCountsRaw.map((s) => [s.status, s._count.status]));
  const pipelineMax = Math.max(1, ...PIPELINE_STAGES.map((s) => stageCounts.get(s.id) ?? 0));

  // Lead source breakdown
  const totalSources = sourceCountsRaw.reduce((acc, s) => acc + s._count.id, 0);
  const sourceRows = sourceCountsRaw
    .map((s) => ({
      source: SOURCE_LABELS[s.sourceType] ?? s.sourceType,
      percent: totalSources ? Math.round((s._count.id / totalSources) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent);

  const newLabel = `${newThisWeek} new this week`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Here&rsquo;s what&rsquo;s happening with your lead pipeline today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Leads" value={String(totalLeads)} change={newLabel} trend="up" />
        <StatCard title="New This Week" value={String(newThisWeek)} change="leads created this week" trend="up" />
        <StatCard title="Qualified" value={String(qualifiedCount)} change="leads qualified by AI" trend="up" />
        <StatCard title="Open Opportunities" value={String(openOpportunities)} change="in active pipeline" trend="up" />
        <StatCard title="Bounced Emails" value={String(bouncedEmails)} change={bouncedEmails > 0 ? "hard bounces" : "neutral"} trend="down" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>Lead Trend</CardTitle>
            <CardDescription>Leads captured over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {recentLeads.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No leads yet — run AI Research or import a CSV to get started.
              </div>
            ) : (
              <div className="flex h-full items-end gap-2 px-4 py-6">
                {trend.map((count, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/60 rounded-sm transition-all"
                    style={{ height: `${(count / trendMax) * 100}%`, minHeight: count > 0 ? "8px" : "4px" }}
                    title={`${count} lead(s)`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Source Breakdown</CardTitle>
            <CardDescription>Where your leads are coming from</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources yet.</p>
            ) : (
              sourceRows.map((row) => (
                <SourceRow key={row.source} source={row.source} value={`${row.percent}%`} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Summary</CardTitle>
            <CardDescription>Leads by pipeline stage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {PIPELINE_STAGES.map((s) => (
              <PipelineRow
                key={s.id}
                stage={s.label}
                value={stageCounts.get(s.id) ?? 0}
                max={pipelineMax}
                color={s.color}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Follow-ups Due</CardTitle>
            <CardDescription>Tasks requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {followups.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" />
                No follow-ups due right now.
              </div>
            ) : (
              followups.map((f) => {
                const lead = leadById.get(f.leadId);
                const overdue = new Date(f.dueAt) < now;
                return (
                  <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div
                      className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                        overdue ? "bg-destructive" : "bg-amber"
                      }`}
                    />
                    <div className="text-sm">
                      <p className="font-medium">
                        {overdue ? "Overdue: " : ""}
                        {lead?.name ?? "Follow-up"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {lead?.industry ? lead.industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "General"} · due {new Date(f.dueAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function SuperAdminDashboard() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const companies = await prisma.tenant.findMany({
    where: { slug: { not: "platform" } },
    orderBy: { createdAt: "desc" },
  });
  const companyIds = companies.map((c) => c.id);

  const [
    activeUsers,
    newLeadsThisWeek,
    leadGroups,
    userGroups,
    costGroups,
    aiRequestsThisMonth,
    providers,
    enabledModels,
    totalModels,
    assignmentCount,
    storedCredentials,
    profiles,
    recentActivity,
    activeChatbots,
    pendingJobs,
  ] = await Promise.all([
    prisma.tenantUser.count({ where: { status: "ACTIVE" } }),
    prisma.lead.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.lead.groupBy({
      by: ["tenantId", "status"],
      _count: { id: true },
    }),
    prisma.tenantUser.groupBy({
      by: ["tenantId"],
      where: { tenantId: { in: companyIds }, status: "ACTIVE" },
      _count: { id: true },
    }),
    prisma.aICostLog.groupBy({
      by: ["tenantId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { estimatedCost: true },
    }),
    prisma.aIUsageLog.count({
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.aIProvider.findMany({ select: { enabled: true } }),
    prisma.aIModel.count({ where: { enabled: true } }),
    prisma.aIModel.count(),
    prisma.aIModuleAssignment.count(),
    prisma.aICredential.count(),
    prisma.companyProfile.findMany({
      where: { tenantId: { in: companyIds } },
      select: { tenantId: true, industry: true, onboardingCompleted: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        category: true,
        actorType: true,
        tenantId: true,
        createdAt: true,
      },
    }),
    prisma.chatbot.count({ where: { status: "active" } }),
    prisma.automationJob.count({ where: { status: "pending" } }),
  ]);

  const profileByTenant = new Map(profiles.map((p) => [p.tenantId, p]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const leadsByTenant = new Map<string, number>();
  const qualifiedByTenant = new Map<string, number>();
  let totalLeads = 0;
  let totalQualified = 0;

  for (const row of leadGroups) {
    const count = row._count.id;
    totalLeads += count;
    leadsByTenant.set(row.tenantId, (leadsByTenant.get(row.tenantId) ?? 0) + count);
    if (row.status === "qualified") {
      totalQualified += count;
      qualifiedByTenant.set(
        row.tenantId,
        (qualifiedByTenant.get(row.tenantId) ?? 0) + count
      );
    }
  }

  const usersByTenant = new Map(userGroups.map((g) => [g.tenantId, g._count.id]));
  const costByTenant = new Map(
    costGroups.map((g) => [g.tenantId, Number(g._sum.estimatedCost ?? 0)])
  );
  const aiSpendThisMonth = costGroups.reduce(
    (sum, g) => sum + Number(g._sum.estimatedCost ?? 0),
    0
  );
  const activeCompanies = companies.filter((c) => c.status === "ACTIVE").length;
  const enabledProviders = providers.filter((p) => p.enabled).length;

  const envKeys = [
    process.env.ANTHROPIC_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GROQ_API_KEY,
    process.env.XAI_API_KEY,
  ].filter((v) => v && v.trim()).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Platform Overview</h1>
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Super Admin
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Platform health, company activity and AI operations across all workspaces.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/companies"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Building2 className="h-4 w-4" /> Manage companies
          </Link>
          <Link
            href="/ai-usage"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Activity className="h-4 w-4" /> AI usage
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Companies"
          value={String(companies.length)}
          change={`${activeCompanies} active`}
          trend="up"
        />
        <StatCard
          title="Users"
          value={String(activeUsers)}
          change="active accounts"
          trend="up"
        />
        <StatCard
          title="Total Leads"
          value={String(totalLeads)}
          change={`${newLeadsThisWeek} new this week · ${totalQualified} qualified`}
          trend="up"
        />
        <StatCard
          title="AI Spend (This Month)"
          value={`$${aiSpendThisMonth.toFixed(2)}`}
          change={`${aiRequestsThisMonth} AI requests`}
          trend="up"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" /> AI Infrastructure
            </CardTitle>
            <CardDescription>Providers, models and module routing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Active providers"
              value={`${enabledProviders}/${providers.length}`}
            />
            <InfoRow
              label="Enabled models"
              value={`${enabledModels}/${totalModels}`}
            />
            <InfoRow label="Module assignments" value={String(assignmentCount)} />
            <InfoRow
              label="API keys"
              value={
                storedCredentials > 0
                  ? `${storedCredentials} stored`
                  : `${envKeys} via environment`
              }
            />
            <InfoRow label="Active chatbots" value={String(activeChatbots)} />
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Pending jobs</span>
              {pendingJobs > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {pendingJobs} queued
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> All clear
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { href: "/ai-providers", label: "Providers" },
                { href: "/ai-models", label: "Models" },
                { href: "/ai-assignments", label: "Assignments" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Platform Activity</CardTitle>
              <CardDescription>Latest events across all companies</CardDescription>
            </div>
            <Link
              href="/audit-logs"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No platform activity recorded yet.
              </p>
            ) : (
              recentActivity.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize">
                      {a.action.replace(/[._]/g, " ")}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {a.tenantId
                        ? companyById.get(a.tenantId)?.name ?? "Platform"
                        : "Platform"}{" "}
                      · {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {a.actorType}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Companies</CardTitle>
            <CardDescription>Workspace activity for every company</CardDescription>
          </div>
          <Link
            href="/admin/companies"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Manage all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No companies yet. Create one from company management.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 pr-4 font-medium text-muted-foreground">Company</th>
                    <th className="py-3 font-medium text-muted-foreground">Status</th>
                    <th className="py-3 font-medium text-muted-foreground">Users</th>
                    <th className="py-3 font-medium text-muted-foreground">Leads</th>
                    <th className="py-3 font-medium text-muted-foreground">Qualified</th>
                    <th className="py-3 font-medium text-muted-foreground">AI Spend</th>
                    <th className="py-3 font-medium text-muted-foreground">Onboarding</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => {
                    const profile = profileByTenant.get(c.id);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border transition-colors hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          <Link
                            href={`/admin/companies/${c.id}`}
                            className="font-medium hover:underline"
                          >
                            {c.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {profile?.industry ? profile.industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : c.slug}
                          </p>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              c.status === "ACTIVE"
                                ? "default"
                                : c.status === "TRIAL"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-3">{usersByTenant.get(c.id) ?? 0}</td>
                        <td className="py-3">{leadsByTenant.get(c.id) ?? 0}</td>
                        <td className="py-3">{qualifiedByTenant.get(c.id) ?? 0}</td>
                        <td className="py-3">
                          ${(costByTenant.get(c.id) ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3">
                          {profile?.onboardingCompleted ? (
                            <Badge variant="secondary">Onboarded</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/admin/companies"
          icon={Building2}
          title="Company management"
          description="Status, modules and members"
        />
        <QuickLink
          href="/ai-assignments"
          icon={Bot}
          title="AI module routing"
          description="Assign models and fallbacks"
        />
        <QuickLink
          href="/audit-logs"
          icon={Activity}
          title="Audit logs"
          description="Security and activity trail"
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}

function StatCard({
  title,
  value,
  change,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold">{value}</div>
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
            trend === "up" ? "text-emerald" : "text-red"
          }`}
        >
          <span aria-hidden>{trend === "up" ? "▲" : "▼"}</span>
          {change}
        </p>
      </CardContent>
    </Card>
  );
}

function SourceRow({ source, value }: { source: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{source}</span>
      <div className="flex items-center gap-1">
        <span className="font-medium">{value}</span>
      </div>
    </div>
  );
}

function PipelineRow({
  stage,
  value,
  max,
  color,
}: {
  stage: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{stage}</span>
      <div className="w-full max-w-[60px] h-1.5 bg-border rounded-full overflow-hidden ml-4">
        <div
          className={`h-full ${color}`}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
      <span className="font-medium w-10 text-right">{value}</span>
    </div>
  );
}

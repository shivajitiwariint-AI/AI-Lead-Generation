import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  Building,
  Target,
  Clock,
  User,
  Edit,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { LeadTakeoverToggle } from "@/components/lead-takeover-toggle";
import { DeleteLeadButton } from "@/components/delete-lead-button";
import { LeadOwnerAssign } from "@/components/lead-owner-assign";
import Link from "next/link";

const STATUS_OPTIONS: Record<string, string> = {
  new: "bg-blue/10 text-blue border-blue/20",
  unreviewed: "bg-amber/10 text-amber border-amber/20",
  qualified: "bg-green/10 text-green border-green/20",
  contacted: "bg-purple/10 text-purple border-purple/20",
  meeting_scheduled: "bg-indigo/10 text-indigo border-indigo/20",
  proposal: "bg-orange/10 text-orange border-orange/20",
  won: "bg-emerald/10 text-emerald border-emerald/20",
  lost: "bg-red/10 text-red border-red/20",
  disqualified: "bg-gray/10 text-gray border-gray/20",
};

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await getAuthContext();

  const leadWhere: any = { id: params.id };
  if (!ctx.isSuperAdmin && ctx.tenantId) {
    leadWhere.tenantId = ctx.tenantId;
  }
  const lead = await prisma.lead.findFirst({
    where: leadWhere,
  });

  if (!lead) {
    notFound();
  }

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
    }),
    prisma.leadSource.findFirst({
      where: { leadId: params.id, tenantId: lead.tenantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const lastEmail = emails[0] ?? null;
  const lastMeta = (lastEmail?.meta ?? {}) as Record<string, any>;

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
      const ordered = new Map(memberships.map((m, i) => [m.userId, i]));
      users.sort((a, b) => (ordered.get(a.id) ?? 0) - (ordered.get(b.id) ?? 0));
      return users;
    })(),
  ]);

  const statusClass = STATUS_OPTIONS[lead.status] || "bg-gray/10 text-gray";

  return (
    <div className="container mx-auto px-6 py-8">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/leads" className="text-primary hover:underline">
          Leads
        </Link>
        <span className="mx-2">/</span>
        <span>{lead.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>{lead.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {lead.company || "No company"} • {lead.industry || "No industry"}
                </p>
              </div>
              <Badge variant="outline" className={statusClass}>
                {lead.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Company</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.company || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                            {lead.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                            {lead.phone}
                          </a>
                        ) : (
                          "-"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Industry</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.industry || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.location || "-"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Owner</p>
                      <p className="text-sm text-muted-foreground">
                        {owner?.name ?? owner?.email ?? "Unassigned"}
                      </p>
                      {owner?.email && owner?.name ? (
                        <p className="text-xs text-muted-foreground">{owner.email}</p>
                      ) : null}
                      <LeadOwnerAssign
                        leadId={lead.id}
                        ownerId={lead.ownerId ?? null}
                        ownerName={owner?.name ?? owner?.email ?? null}
                        ownerEmail={owner?.email ?? null}
                        members={members}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">AI Score</p>
                      <p className="text-sm font-semibold">
                        {lead.score}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Last Contacted</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {lead.requirement && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-sm font-semibold mb-2">Requirement</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {lead.requirement}
                  </p>
                </div>
              )}

              {lead.aiSummary && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-sm font-semibold mb-2">AI Summary</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {lead.aiSummary}
                  </p>
                </div>
              )}

              <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed">
                <p className="font-semibold text-amber-700">⚠️ Synthetic AI-generated prospect — not a verified person</p>
                <p className="mt-1 text-muted-foreground">
                  This lead was invented by the AI (Groq `openai/gpt-oss-120b`) from your target criteria — it was <strong>not</strong> scraped from MagicBricks/99acres/LinkedIn. Name `Rajesh Verma`, `rajesh.verma@urbannest.in`, `+91-9876501234`, and LinkedIn are plausible but unverified. `consentMarketing = false` (no consent). Verify contact details independently before any real outreach. The email below was <strong>simulated</strong> (no `RESEND_API_KEY` configured) — it was not delivered.
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-sm font-semibold mb-2">Outreach email AI sent</h3>
                {!lastEmail ? (
                  <p className="text-sm text-muted-foreground">No email drafted yet. Open “Draft Message” to generate one.</p>
                ) : (
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{lastEmail.status}</Badge>
                      <Badge variant={lastMeta.simulated ? "secondary" : "default"}>
                        {lastMeta.simulated ? "Simulated (not delivered)" : "Sent"}
                      </Badge>
                      <Badge variant="outline">{lastMeta.mock ? "Local engine" : "Live model"}</Badge>
                      {lastMeta.model && <span className="text-muted-foreground">Model {String(lastMeta.model).slice(0, 8)}…</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      To: {lastEmail.toAddress} · {lastEmail.sentAt ? `Sent ${new Date(lastEmail.sentAt).toLocaleString()}` : `Created ${new Date(lastEmail.createdAt).toLocaleString()}`}
                    </p>
                    {lastMeta.website && (
                      <p className="text-xs text-muted-foreground">
                        Website in email: <a href={String(lastMeta.website)} target="_blank" rel="noreferrer" className="text-primary hover:underline">{String(lastMeta.website)}</a>
                      </p>
                    )}
                    {Array.isArray(lastMeta.attachments) && lastMeta.attachments.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                        {(lastMeta.attachments as Array<{ name: string; url: string }>).map((a) => (
                          <p key={a.url} className="text-xs">
                            <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">📎 {a.name}</a>
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-sm font-medium">Subject: {lastEmail.subject}</p>
                    <pre className="whitespace-pre-wrap rounded bg-muted/50 p-3 text-sm">{lastEmail.body}</pre>
                    <p className="text-xs text-muted-foreground">
                      Note: body is generic because the email was generated by the local mock engine (provider local, `mock: true`), not the live Groq model. Re-draft via “Draft Message” for a property-specific version.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        {activity.activityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Button className="w-full" asChild>
                <Link href={`/leads/${lead.id}/edit`}>
                  <Edit className="h-4 w-4 mr-2" /> Edit Lead
                </Link>
              </Button>
              <Button className="w-full" variant="outline" asChild>
                <Link href={`/leads/${lead.id}/message`}>
                  <MessageCircle className="h-4 w-4 mr-2" /> Draft Message
                </Link>
              </Button>
              <Button className="w-full" variant="outline" asChild>
                <Link href={`/leads/${lead.id}/followup`}>
                  <Clock className="h-4 w-4 mr-2" /> Schedule Follow-up
                </Link>
              </Button>
              <LeadTakeoverToggle leadId={lead.id} initialMode={lead.controlMode} />
              <DeleteLeadButton leadId={lead.id} name={lead.name} />
            </CardContent>
          </Card>

          {qualification && (
            <Card>
              <CardHeader>
                <CardTitle>AI Qualification</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Fit Score</p>
                    <p className="text-lg font-semibold">{qualification.fitScore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Intent Score</p>
                    <p className="text-lg font-semibold">{qualification.intentScore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Urgency Score</p>
                    <p className="text-lg font-semibold">{qualification.urgencyScore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Completeness</p>
                    <p className="text-lg font-semibold">{qualification.completenessScore}</p>
                  </div>
                </div>
                {qualification.summary && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm text-muted-foreground">
                      {qualification.summary}
                    </p>
                  </div>
                )}
                {qualification.nextAction && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Recommended Action</p>
                    <p className="text-sm font-medium">
                      {qualification.nextAction}
                    </p>
                  </div>
                )}
                {Array.isArray((qualification as any).matchedOffers) &&
                  ((qualification as any).matchedOffers as any[]).length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-1">
                        Matched Offers ({(qualification as any).matchedOffers.length})
                      </p>
                      <ul className="space-y-2">
                        {((qualification as any).matchedOffers as any[]).slice(0, 5).map((m: any, i: number) => (
                          <li
                            key={i}
                            className="rounded-lg border border-border p-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{m.offer}</span>
                              <Badge variant="secondary">{m.score}/100</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{m.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {typeof (qualification as any).matchScore === "number" && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Match Score</p>
                    <p className="text-lg font-semibold">
                      {(qualification as any).matchScore}/100
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

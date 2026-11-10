"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  Plus,
  UserPlus,
  Mail,
  Phone,
  Building,
  Target,
  Clock,
  Sparkles,
  Trash2,
  Hand,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LeadOwnerAssign, type Member } from "@/components/lead-owner-assign";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue/10 text-blue" },
  { value: "unreviewed", label: "Unreviewed", color: "bg-amber/10 text-amber" },
  { value: "qualified", label: "Qualified", color: "bg-green/10 text-green" },
  { value: "contacted", label: "Contacted", color: "bg-purple/10 text-purple" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", color: "bg-indigo/10 text-indigo" },
  { value: "proposal", label: "Proposal", color: "bg-orange/10 text-orange" },
  { value: "won", label: "Won", color: "bg-emerald/10 text-emerald" },
  { value: "lost", label: "Lost", color: "bg-red/10 text-red" },
  { value: "disqualified", label: "Disqualified", color: "bg-gray/10 text-gray" },
];

const SOURCE_OPTIONS = [
  { value: "research", label: "AI Research", color: "bg-primary/10 text-primary" },
  { value: "website", label: "Website Forms", color: "bg-blue/10 text-blue" },
  { value: "csv", label: "CSV Import", color: "bg-accent/10 text-accent" },
  { value: "whatsapp", label: "WhatsApp", color: "bg-green/10 text-green" },
  { value: "email", label: "Email", color: "bg-indigo/10 text-indigo" },
  { value: "manual", label: "Manual", color: "bg-gray/10 text-gray" },
  { value: "referral", label: "Referral", color: "bg-purple/10 text-purple" },
];

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
      }
    >
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [lastAiResult, setLastAiResult] = useState<null | {
    status: string;
    summary: string;
    metrics: Record<string, number>;
    steps: Array<{ step: string; status: string; detail?: string; at?: string }>;
  }>(null);

  const deleteLead = async (leadId: string, name: string) => {
    if (!confirm(`Delete lead “${name}”? This removes the lead and its emails/activities. This cannot be undone.`)) return;
    setDeletingId(leadId);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}`, { method: "DELETE" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Delete failed");
      toast.success("Lead deleted");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      await fetchLeads();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected lead(s)? This removes their emails/activities. This cannot be undone.`)) return;
    setBulkDeleting(true);
    let ok = 0;
    let failed = 0;
    for (const leadId of ids) {
      try {
        const res = await fetch(`/api/v1/leads/${leadId}`, { method: "DELETE" });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    toast.success(`Deleted ${ok} lead(s)${failed ? `, ${failed} failed` : ""}`);
    await fetchLeads();
  };

  const bulkControl = async (mode: "manual" | "ai") => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkDeleting(true);
    let ok = 0;
    let failed = 0;
    for (const leadId of ids) {
      try {
        const res = await fetch(`/api/v1/leads/${leadId}/control`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlMode: mode }),
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkDeleting(false);
    toast.success(`${mode === "manual" ? "Manual takeover" : "AI resumed"} for ${ok} lead(s)}${failed ? `, ${failed} failed` : ""}`);
    await fetchLeads();
  };

  const formatMetrics = (m?: Record<string, number>) => {
    if (!m) return "";
    const parts: string[] = [];
    if (m.leadsCreated) parts.push(`${m.leadsCreated} lead(s) created`);
    if (m.leadsQualified) parts.push(`${m.leadsQualified} qualified`);
    if (m.emailsDrafted) parts.push(`${m.emailsDrafted} email(s) drafted`);
    if (m.emailsSent) parts.push(`${m.emailsSent} sent`);
    if (m.emailsPendingApproval) parts.push(`${m.emailsPendingApproval} awaiting approval`);
    if (m.meetingsProposed) parts.push(`${m.meetingsProposed} meeting(s) proposed`);
    if (m.followupsHandled) parts.push(`${m.followupsHandled} follow-up(s) handled`);
    return parts.join(" · ");
  };

  const runAi = async (leadId?: string) => {
    setAiBusy(leadId ?? "all");
    try {
      const res = await fetch("/api/v1/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadId ? { leadId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "AI failed");

      setLastAiResult({
        status: data.status ?? "completed",
        summary: data.summary ?? "",
        metrics: data.metrics ?? {},
        steps: Array.isArray(data.steps) ? data.steps : [],
      });

      const detail = formatMetrics(data.metrics);
      if (data.status === "paused") {
        toast.info(data.summary || "AI is paused");
      } else if (data.status === "failed") {
        toast.error(data.summary || "AI workflow failed");
      } else if (detail) {
        toast.success(`AI finished — ${detail}`);
      } else if (data.summary) {
        toast.success(data.summary);
      } else {
        toast.success("AI workflow finished");
      }
      await fetchLeads();
    } catch (e: any) {
      toast.error(e.message || "AI workflow failed");
    } finally {
      setAiBusy(null);
    }
  };
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetch("/api/v1/team/members")
      .then((r) => r.json())
      .then((d) => setMembers(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setMembers([]));
  }, []);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    params.set("page", "1");
    params.set("limit", "50");

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/leads?${params.toString()}`, {
        headers: { "X-Tenant-Id": "default-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
        setTotal(data.meta?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const sourceBadge = (source: string) => {
    const opt = SOURCE_OPTIONS.find((o) => o.value === source);
    return (
      <Badge variant="outline" className={opt?.color || "bg-gray/10 text-gray"}>
        {opt?.label || source || "-"}
      </Badge>
    );
  };

  const statusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find((o) => o.value === status);
    return (
      <Badge variant="outline" className={opt?.color || "bg-gray/10 text-gray"}>
        {opt?.label || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const aiDetail = formatMetrics(lastAiResult?.metrics);

  return (
    <div className="container mx-auto px-6 py-8">
      {lastAiResult && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  AI {lastAiResult.status === "completed" ? "finished" : lastAiResult.status}
                  {aiDetail ? ` — ${aiDetail}` : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setLastAiResult(null)}>
                  Dismiss
                </Button>
                <Button size="sm" asChild>
                  <a href="/activity">View activity</a>
                </Button>
              </div>
            </div>
            {lastAiResult.steps.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {lastAiResult.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={s.status === "ok" ? "text-emerald-600" : s.status === "failed" ? "text-destructive" : ""}>
                      {s.status === "ok" ? "✓" : s.status === "failed" ? "✗" : "–"}
                    </span>
                    <span className="font-medium">{s.step}</span>
                    <span>{s.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Manage your sales pipeline and lead database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-primary/40 text-primary"
            onClick={() => runAi()}
            disabled={aiBusy === "all"}
            title="Ask AI: generate leads, qualify them, send outreach and propose meetings"
          >
            <Sparkles className={cn("h-4 w-4", aiBusy === "all" && "animate-pulse")} />
            {aiBusy === "all" ? "AI is working…" : "Ask AI"}
          </Button>
          <Button onClick={() => {}} asChild title="Add a lead manually">
            <a href="/leads/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Lead
            </a>
          </Button>
          <Button variant="outline" className="gap-2" asChild title="Import leads from a CSV file">
            <a href="/leads/import" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Import CSV
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Leads ({total})</CardTitle>
          <div className="flex items-center gap-2">
            <input
              type="search"
              className="h-9 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search by name, email, company..."
              title="Search leads by name, email or company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              title="Clear status filter"
              aria-label="Clear status filter"
              onClick={() => {
                setStatusFilter("");
              }}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="-mx-2">
            <div className="flex flex-wrap gap-2 px-2 py-2">
              <Button
                variant={!statusFilter ? "default" : "outline"}
                size="sm"
                title="Show all leads"
                onClick={() => setStatusFilter("")}
              >
                All
              </Button>
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={statusFilter === opt.value ? "default" : "outline"}
                  size="sm"
                  title={`Show ${opt.label} leads`}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    statusFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : ""
                  )}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 px-2 pb-2 items-center">
              <span className="self-center text-xs text-muted-foreground">Source:</span>
              <Select value={sourceFilter || "__all__"} onValueChange={(v: any) => setSourceFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-44" title="Filter by lead source">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sources</SelectItem>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedIds.size > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={deleteSelected}
                    disabled={bulkDeleting}
                    title={`Delete ${selectedIds.size} selected lead(s)`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {bulkDeleting ? "Deleting…" : `Delete selected (${selectedIds.size})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkControl("manual")}
                    disabled={bulkDeleting}
                    title={`Manual takeover for ${selectedIds.size} selected lead(s) — AI stops`}
                  >
                    <Hand className="h-3 w-3 mr-1" /> Takeover selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkControl("ai")}
                    disabled={bulkDeleting}
                    title={`Resume AI for ${selectedIds.size} selected lead(s)`}
                  >
                    <Bot className="h-3 w-3 mr-1" /> Resume AI
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selectedIds.size === leads.length}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? new Set(leads.map((l) => l.id)) : new Set())
                      }
                      title="Select all leads on this page"
                      aria-label="Select all leads on this page"
                    />
                  </TableHead>
                  <TableHead className="w-20">Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead className="w-48">Email</TableHead>
                  <TableHead className="w-40">Phone</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-16">Score</TableHead>
                  <TableHead className="w-24">Source</TableHead>
                  <TableHead className="w-44">Owner</TableHead>
                  <TableHead className="w-20">Last Contacted</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length > 0 ? (
                  leads.map((lead) => (
                    <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-destructive/5" : ""}>
                      <TableCell className="pr-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(lead.id);
                              else next.delete(lead.id);
                              return next;
                            })
                          }
                          title={`Select ${lead.name} for bulk delete`}
                          aria-label={`Select ${lead.name} for bulk delete`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {lead.name}
                      </TableCell>
                      <TableCell>{lead.company || "-"}</TableCell>
                      <TableCell>
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`} title={`Send email to ${lead.email}`} className="text-primary hover:underline">
                            {lead.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} title={`Call ${lead.phone}`} className="text-primary hover:underline">
                            {lead.phone}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(lead.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center text-xs">
                          {lead.score}
                        </Badge>
                      </TableCell>
                      <TableCell>{sourceBadge(lead.sourceType)}</TableCell>
                      <TableCell>
                        <LeadOwnerAssign
                          leadId={lead.id}
                          ownerId={lead.ownerId ?? null}
                          ownerName={lead.ownerName ?? null}
                          ownerEmail={lead.ownerEmail ?? null}
                          members={members}
                          compact
                          onAssigned={(ownerId, ownerName, ownerEmail) =>
                            setLeads((prev) =>
                              prev.map((l) => (l.id === lead.id ? { ...l, ownerId, ownerName, ownerEmail } : l))
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {lead.lastContactedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {new Date(lead.lastContactedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1"
                            onClick={() => runAi(lead.id)}
                            disabled={aiBusy === lead.id}
                            title="Ask AI: qualify & outreach for this lead"
                            aria-label={`Ask AI for ${lead.name}`}
                          >
                            <Sparkles className={cn("h-4 w-4 text-primary", aiBusy === lead.id && "animate-pulse")} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1"
                            title="View lead details, timeline & qualification"
                            aria-label={`View ${lead.name} details`}
                          >
                            <a href={`/leads/${lead.id}`}>
                              <Clock className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1"
                            title="View AI score & matched offers"
                            aria-label={`View score for ${lead.name}`}
                          >
                            <Target className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-1 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => deleteLead(lead.id, lead.name)}
                            disabled={deletingId === lead.id}
                            title="Delete this lead (wrong/fake create)"
                            aria-label={`Delete ${lead.name}`}
                          >
                            {deletingId === lead.id ? (
                              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={11}>
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Mail className="h-8 w-8 mb-2 opacity-50" />
                        <p>No leads found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

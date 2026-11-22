"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus,
  UserPlus,
  Mail,
  Target,
  Clock,
  Sparkles,
  Trash2,
  Hand,
  Bot,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
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

const PAGE_SIZES = [25, 50, 100];

/** Run async work with a small concurrency limit so bulk actions stay fast. */
async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      try {
        await fn(item);
      } catch {
        /* failures are counted by the caller */
      }
    }
  });
  await Promise.all(workers);
}

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
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(() => searchParams.get("search") ?? "");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "");
  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [pageSize, setPageSize] = useState(50);

  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [lastAiResult, setLastAiResult] = useState<null | {
    status: string;
    summary: string;
    metrics: Record<string, number>;
    steps: Array<{ step: string; status: string; detail?: string; at?: string }>;
  }>(null);

  // Debounce typing so we don't fire a request on every keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  // Keep the URL shareable / bookmarkable.
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 50) params.set("limit", String(pageSize));
    const qs = params.toString();
    router.replace(qs ? `/leads?${qs}` : "/leads", { scroll: false });
  }, [search, statusFilter, sourceFilter, page, pageSize, router]);

  // Accept a search coming from the global header search box.
  const urlSearch = searchParams.get("search") ?? "";
  const lastUrlSearch = useRef(urlSearch);
  useEffect(() => {
    if (urlSearch === lastUrlSearch.current) return;
    lastUrlSearch.current = urlSearch;
    setSearchInput(urlSearch);
    setSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);

  useEffect(() => {
    fetch("/api/v1/team/members")
      .then((r) => r.json())
      .then((d) => setMembers(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setMembers([]));
  }, []);

  // Clear selection whenever the visible result set changes.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, statusFilter, sourceFilter, page, pageSize]);

  const fetchLeads = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      setFetching(true);
      try {
        const res = await fetch(`/api/v1/leads?${params.toString()}`, { signal });
        if (res.ok) {
          const data = await res.json();
          if (signal?.aborted) return;
          setLeads(data.data || []);
          setTotal(data.meta?.total || 0);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          toast.error("Could not load leads. Check your connection and try again.");
        }
      } finally {
        if (!signal?.aborted) {
          setFetching(false);
          setInitialLoading(false);
        }
      }
    },
    [search, statusFilter, sourceFilter, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchLeads(controller.signal);
    return () => controller.abort();
  }, [fetchLeads, reloadKey]);

  // If the current page no longer exists (e.g. after deleting leads), step back.
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const reload = () => setReloadKey((k) => k + 1);

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
      reload();
    } catch (e: any) {
      toast.error(e.message || "AI workflow failed");
    } finally {
      setAiBusy(null);
    }
  };

  const deleteLead = async (leadId: string, name: string) => {
    if (!confirm(`Delete lead “${name}”? This removes the lead and its emails/activities. This cannot be undone.`))
      return;
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
      reload();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected lead(s)? This removes their emails/activities. This cannot be undone.`))
      return;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    await runLimited(ids, 4, async (leadId) => {
      const res = await fetch(`/api/v1/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) ok++;
      else failed++;
    });
    setBulkBusy(false);
    setSelectedIds(new Set());
    toast.success(`Deleted ${ok} lead(s)${failed ? `, ${failed} failed` : ""}`);
    reload();
  };

  const bulkControl = async (mode: "manual" | "ai") => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    await runLimited(ids, 4, async (leadId) => {
      const res = await fetch(`/api/v1/leads/${leadId}/control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlMode: mode }),
      });
      if (res.ok) ok++;
      else failed++;
    });
    setBulkBusy(false);
    toast.success(
      `${mode === "manual" ? "Manual takeover" : "AI resumed"} for ${ok} lead(s)${failed ? `, ${failed} failed` : ""}`
    );
    reload();
  };

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

  const aiDetail = formatMetrics(lastAiResult?.metrics);
  const hasFilters = Boolean(search || statusFilter || sourceFilter);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setSourceFilter("");
    setPage(1);
  };

  if (initialLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

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
                    <span
                      className={
                        s.status === "ok"
                          ? "text-emerald-600"
                          : s.status === "failed"
                            ? "text-destructive"
                            : ""
                      }
                    >
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
          <p className="text-muted-foreground">Manage your sales pipeline and lead database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button asChild title="Add a lead manually">
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
        <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">
            Leads ({total})
            {fetching && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">Updating…</span>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-72"
                placeholder="Search name, email, company…"
                title="Search leads by name, email or company"
                aria-label="Search leads"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              title="Refresh leads"
              aria-label="Refresh leads"
              onClick={reload}
              disabled={fetching}
            >
              <RefreshCw className={cn("h-4 w-4", fetching && "animate-spin")} />
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="-mx-2">
            <div className="flex flex-wrap gap-2 px-2 py-2">
              <Button
                variant={!statusFilter ? "default" : "outline"}
                size="sm"
                title="Show all leads"
                onClick={() => {
                  setStatusFilter("");
                  setPage(1);
                }}
              >
                All
              </Button>
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={statusFilter === opt.value ? "default" : "outline"}
                  size="sm"
                  title={`Show ${opt.label} leads`}
                  onClick={() => {
                    setStatusFilter(opt.value === statusFilter ? "" : opt.value);
                    setPage(1);
                  }}
                  className={cn(statusFilter === opt.value ? "bg-primary text-primary-foreground" : "")}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 px-2 pb-2 items-center">
              <span className="self-center text-xs text-muted-foreground">Source:</span>
              <Select
                value={sourceFilter || "__all__"}
                onValueChange={(v: any) => {
                  setSourceFilter(v === "__all__" ? "" : v);
                  setPage(1);
                }}
              >
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
              <span className="self-center text-xs text-muted-foreground">Rows:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v: any) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-20" title="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
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
                    disabled={bulkBusy}
                    title={`Delete ${selectedIds.size} selected lead(s)`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {bulkBusy ? "Working…" : `Delete selected (${selectedIds.size})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkControl("manual")}
                    disabled={bulkBusy}
                    title={`Manual takeover for ${selectedIds.size} selected lead(s) — AI stops`}
                  >
                    <Hand className="h-3 w-3 mr-1" /> Takeover selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkControl("ai")}
                    disabled={bulkBusy}
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
                          title={`Select ${lead.name} for bulk actions`}
                          aria-label={`Select ${lead.name} for bulk actions`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <a href={`/leads/${lead.id}`} className="hover:text-primary hover:underline">
                          {lead.name}
                        </a>
                      </TableCell>
                      <TableCell>{lead.company || "-"}</TableCell>
                      <TableCell>
                        {lead.email ? (
                          <a
                            href={`mailto:${lead.email}`}
                            title={`Send email to ${lead.email}`}
                            className="text-primary hover:underline"
                          >
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
                        <div className="flex items-center justify-end gap-1.5">
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
                            title="Draft or review outreach email"
                            aria-label={`Email ${lead.name}`}
                          >
                            <a href={`/leads/${lead.id}#email-outreach`}>
                              <Mail className="h-4 w-4" />
                            </a>
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
                    <TableCell className="h-40 text-center" colSpan={11}>
                      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                        <Target className="h-8 w-8 opacity-50" />
                        <div>
                          <p className="font-medium text-foreground">
                            {hasFilters ? "No leads match these filters" : "No leads yet"}
                          </p>
                          <p className="text-sm">
                            {hasFilters
                              ? "Try a different search term or clear the filters."
                              : "Run AI research or import a CSV to get started."}
                          </p>
                        </div>
                        {hasFilters ? (
                          <Button size="sm" variant="outline" onClick={clearFilters}>
                            Clear filters
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" asChild>
                              <a href="/research">Run AI research</a>
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <a href="/leads/import">Import CSV</a>
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              {total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || fetching}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || fetching}
                aria-label="Next page"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

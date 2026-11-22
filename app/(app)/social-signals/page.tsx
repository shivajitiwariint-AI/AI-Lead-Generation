"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  CheckCircle2,
  ExternalLink,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

interface Signal {
  id: string;
  platform: string;
  kind: string;
  title: string;
  url: string;
  author: string | null;
  authorHandle: string | null;
  externalId: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  snippet: string | null;
  relevanceScore: number;
  status: string;
  leadId: string | null;
  sourceQuery: string | null;
  createdAt: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  x: "X",
  reddit: "Reddit",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  manual: "Manual",
};

const KIND_LABELS: Record<string, string> = {
  short: "Short",
  reel: "Reel",
  video: "Video",
  post: "Post",
};

const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  reviewed: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  converted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  discarded: "bg-muted text-muted-foreground",
};

function compactNumber(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const EMPTY_FORM = {
  platform: "manual",
  kind: "video",
  title: "",
  url: "",
  author: "",
  snippet: "",
  views: "",
  likes: "",
};

export default function SocialSignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("publishedAt");
  const [dir, setDir] = useState("desc");

  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState("10");
  const [discovering, setDiscovering] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        platform,
        kind,
        status,
        sort,
        dir,
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/v1/social/signals?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not load social signals");
      setSignals(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch (error: any) {
      toast.error(error.message || "Could not load social signals");
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }, [page, platform, kind, status, sort, dir, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, platform, kind, status, sort, dir]);

  const discover = async () => {
    if (!query.trim()) {
      toast.error("Enter a topic to discover videos for");
      return;
    }
    setDiscovering(true);
    try {
      const res = await fetch("/api/v1/social/signals/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), maxResults: Number(maxResults) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Discovery failed");
      if (data.saved > 0) {
        toast.success(
          `Saved ${data.saved} signal(s)${data.sources?.length ? ` from ${data.sources.join(", ")}` : ""}`
        );
      } else {
        toast.info("No new signals found. Check the connected API keys or try another topic.");
      }
      if (data.errors?.length) console.warn("Social discovery warnings:", data.errors);
      setQuery("");
      await load();
    } catch (error: any) {
      toast.error(error.message || "Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  const addManual = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      toast.error("A title and URL are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/social/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: form.platform,
          kind: form.kind,
          title: form.title.trim(),
          url: form.url.trim(),
          author: form.author.trim() || null,
          snippet: form.snippet.trim() || null,
          ...(form.views ? { views: Number(form.views) } : {}),
          ...(form.likes ? { likes: Number(form.likes) } : {}),
          relevanceScore: 100,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not add signal");
      toast.success("Signal added to the review queue");
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (error: any) {
      toast.error(error.message || "Could not add signal");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (signal: Signal, next: string) => {
    setBusyId(signal.id);
    try {
      const res = await fetch(`/api/v1/social/signals/${signal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Update failed");
      toast.success(`Signal marked ${next}`);
      await load();
    } catch (error: any) {
      toast.error(error.message || "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const createLead = async (signal: Signal) => {
    setBusyId(signal.id);
    try {
      const res = await fetch(`/api/v1/social/signals/${signal.id}/convert`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not create lead");
      toast.success(data.created ? "Unverified lead created" : "Lead already linked to this signal");
      await load();
    } catch (error: any) {
      toast.error(error.message || "Could not create lead");
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(Math.ceil(total / 25), 1);
  const hasFilters =
    search.trim().length > 0 ||
    platform !== "all" ||
    kind !== "all" ||
    status !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Social Signals</h1>
          <p className="text-muted-foreground">
            Review public social videos and posts found through official APIs. Nothing is scraped,
            and nothing enters the pipeline until you create a lead.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Discover social videos
          </CardTitle>
          <CardDescription>
            YouTube Shorts, X videos and Reddit videos use official APIs. Instagram Reels and
            TikTok videos come from connected accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1 space-y-2">
            <Label htmlFor="discover-query">Topic or problem</Label>
            <Input
              id="discover-query"
              placeholder="e.g. property management software"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="w-32 space-y-2">
            <Label htmlFor="discover-limit">Results</Label>
            <Select value={maxResults} onValueChange={setMaxResults}>
              <SelectTrigger id="discover-limit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={discover} disabled={discovering}>
            <Search className="mr-2 h-4 w-4" />
            {discovering ? "Discovering…" : "Discover"}
          </Button>
          <Button variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" /> Add manually
          </Button>
        </CardContent>
        {showForm && (
          <CardContent className="grid gap-4 border-t pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(value) => setForm({ ...form, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.kind}
                onValueChange={(value) => setForm({ ...form, kind: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="post">Post</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What is this video about?"
              />
            </div>
            <div className="space-y-2">
              <Label>Public URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label>Author (optional)</Label>
              <Input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="Account or channel name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Views</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.views}
                  onChange={(e) => setForm({ ...form, views: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Likes</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.likes}
                  onChange={(e) => setForm({ ...form, likes: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes (optional)</Label>
              <Input
                value={form.snippet}
                onChange={(e) => setForm({ ...form, snippet: e.target.value })}
                placeholder="Why this looks relevant"
              />
            </div>
            <div className="md:col-span-2">
              <Button onClick={addManual} disabled={saving}>
                <Plus className="mr-2 h-4 w-4" /> {saving ? "Adding…" : "Add signal"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-primary" /> Review queue
          </CardTitle>
          <CardDescription>
            {total} signal{total === 1 ? "" : "s"} · leads created here are unverified with no
            marketing consent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Input
              placeholder="Search title or author"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="post">Post</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="discarded">Discarded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="publishedAt">Published date</SelectItem>
                <SelectItem value="relevanceScore">Relevance</SelectItem>
                <SelectItem value="views">Views</SelectItem>
                <SelectItem value="likes">Likes</SelectItem>
                <SelectItem value="comments">Comments</SelectItem>
                <SelectItem value="createdAt">Date added</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dir} onValueChange={setDir}>
              <SelectTrigger>
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest / highest</SelectItem>
                <SelectItem value="asc">Oldest / lowest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Published</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Relevance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signals.length === 0 ? (
                    <TableRow>
                      <TableCell className="h-40 text-center" colSpan={8}>
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Target className="h-8 w-8 opacity-50" />
                          <p className="font-medium text-foreground">
                            {hasFilters ? "No signals match these filters" : "No social signals yet"}
                          </p>
                          <p className="text-sm">
                            {hasFilters
                              ? "Try a different search or clear the filters."
                              : "Discover videos above or add a public URL manually."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    signals.map((signal) => (
                      <TableRow key={signal.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(signal.publishedAt ?? signal.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline">
                              {PLATFORM_LABELS[signal.platform] ?? signal.platform}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {KIND_LABELS[signal.kind] ?? signal.kind}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <a
                            href={signal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 font-medium hover:underline"
                          >
                            {signal.title}
                          </a>
                          {signal.durationSec != null && (
                            <p className="text-[11px] text-muted-foreground">
                              {signal.durationSec}s
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {signal.author ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <span title="Views / likes / comments">
                            <Eye className="mr-1 inline h-3 w-3" />
                            {compactNumber(signal.views)} · {compactNumber(signal.likes)} ·{" "}
                            {compactNumber(signal.comments)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {signal.relevanceScore}/100
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={STATUS_STYLE[signal.status] ?? ""}
                          >
                            {signal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Open on platform"
                            >
                              <a href={signal.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            {signal.status === "new" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Mark reviewed"
                                disabled={busyId === signal.id}
                                onClick={() => updateStatus(signal, "reviewed")}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            {signal.status !== "converted" && signal.status !== "discarded" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Create unverified lead"
                                disabled={busyId === signal.id}
                                onClick={() => createLead(signal)}
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            )}
                            {signal.status !== "converted" && signal.status !== "discarded" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Discard"
                                disabled={busyId === signal.id}
                                onClick={() => updateStatus(signal, "discarded")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {signal.leadId && (
                              <Button variant="ghost" size="icon" asChild title="View lead">
                                <a href={`/leads/${signal.leadId}`}>
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          {fetching && !loading && (
            <p className="text-xs text-muted-foreground">Updating…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Play, Globe, CheckCircle2 } from "lucide-react";
import { SearchScheduleCard } from "@/components/search-schedule-card";
import { RealEstateCard } from "@/components/real-estate-card";
import { SoftwareOutreachCard } from "@/components/software-outreach-card";
import { toast } from "sonner";
import { formatIndustry } from "@/lib/industry";

interface Source {
  id: string;
  name: string;
  sourceType: string;
  url?: string | null;
  approved: boolean;
}
interface Run {
  id: string;
  status: string;
  query?: string | null;
  foundCount: number;
  createdCount: number;
  results?: any;
  error?: string | null;
  createdAt: string;
  sourceId?: string | null;
}

const INDUSTRY_OPTIONS = [
  "Software & IT", "Real Estate", "Retail & Wholesale", "Education", "Healthcare",
  "Travel & Hospitality", "Finance & Insurance", "Professional Services", "Manufacturing & B2B",
];

const COMPANY_SIZES = ["Any size", "1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "500+ employees"];

export default function ResearchPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newSource, setNewSource] = useState({ name: "", sourceType: "search", url: "" });
  const [discover, setDiscover] = useState({
    description: "",
    industry: "",
    location: "",
    companySize: "",
    maxResults: "5",
    sourceId: "",
  });
  const [running, setRunning] = useState(false);

  const load = async () => {
    const [s, r, p] = await Promise.all([
      fetch("/api/v1/research/sources").then((x) => x.json()),
      fetch("/api/v1/research/runs").then((x) => x.json()),
      fetch("/api/v1/company-profile").then((x) => x.json()).catch(() => null),
    ]);
    setSources(Array.isArray(s) ? s : s?.data ?? []);
    setRuns(Array.isArray(r) ? r : r?.data ?? []);
    setProfile(p);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const addSource = async () => {
    if (!newSource.name.trim()) return;
    const res = await fetch("/api/v1/research/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSource),
    });
    if (res.ok) {
      toast.success("Source added");
      setNewSource({ name: "", sourceType: "search", url: "" });
      load();
    } else {
      toast.error("Could not add source");
    }
  };

  const runResearch = async () => {
    if (!discover.description.trim()) {
      toast.error("Describe who you want to discover first");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/v1/research/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: discover.sourceId || undefined,
          query: discover.description.trim(),
          criteria: {
            ...(discover.industry ? { industry: discover.industry } : {}),
            ...(discover.location.trim() ? { location: discover.location.trim() } : {}),
            ...(discover.companySize && discover.companySize !== "Any size" ? { companySize: discover.companySize } : {}),
            maxResults: Number(discover.maxResults) || 5,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Run failed");
      toast.success(`Discovered ${data.result?.foundCount ?? 0}, created ${data.result?.createdCount ?? 0} lead(s)`);
      setDiscover({ description: "", industry: "", location: "", companySize: "", maxResults: "5", sourceId: "" });
      load();
    } catch (e: any) {
      toast.error(e.message || "Research run failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Online Research</h1>
        <p className="text-muted-foreground">
          Discover potential customers using approved sources. Only approved sources are used; every run is audited.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approved Sources</CardTitle>
            <CardDescription>Sources the AI may research</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Source name"
                value={newSource.name}
                onChange={(e: any) => setNewSource({ ...newSource, name: e.target.value })}
                className="flex-1"
              />
              <Select value={newSource.sourceType} onValueChange={(v: any) => setNewSource({ ...newSource, sourceType: v })}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="search">Web search</SelectItem>
                  <SelectItem value="directory">Directory</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="URL (optional)"
                value={newSource.url}
                onChange={(e: any) => setNewSource({ ...newSource, url: e.target.value })}
                className="flex-1"
              />
              <Button onClick={addSource}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {sources.length === 0 && (
                <p className="text-sm text-muted-foreground">No sources yet. Add one above.</p>
              )}
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.sourceType} {s.url ? `· ${s.url}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={s.approved ? "default" : "outline"}>
                    {s.approved ? "Approved" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discover potential customers</CardTitle>
            <CardDescription>
              Tell us who you want to find — the AI researches approved sources based on your input.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Describe your ideal customer</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={discover.description}
                onChange={(e: any) => setDiscover({ ...discover, description: e.target.value })}
                placeholder="e.g. SaaS founders in India with 10–100 employees who struggle with lead follow-ups"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={discover.industry} onValueChange={(v: any) => setDiscover({ ...discover, industry: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((i) => (
                      <SelectItem key={i} value={i}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location / country</Label>
                <Input
                  value={discover.location}
                  onChange={(e: any) => setDiscover({ ...discover, location: e.target.value })}
                  placeholder="e.g. India, UAE, UK"
                />
              </div>
              <div className="space-y-2">
                <Label>Company size</Label>
                <Select value={discover.companySize} onValueChange={(v: any) => setDiscover({ ...discover, companySize: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>How many leads?</Label>
                <Select value={discover.maxResults} onValueChange={(v: any) => setDiscover({ ...discover, maxResults: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "3", "5", "10", "20"].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n} leads
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Approved source</Label>
              <Select value={discover.sourceId} onValueChange={(v: any) => setDiscover({ ...discover, sourceId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Any approved source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only sources approved for your workspace are used.</p>
            </div>
            <Button onClick={runResearch} disabled={running} className="w-full">
              <Play className="mr-2 h-4 w-4" /> {running ? "Researching…" : "Discover customers"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <SearchScheduleCard />
      {(() => {
        const ind = (profile?.industry ?? "").toLowerCase();
        const isRE = /real/.test(ind);
        const isSW = /(software|it|agency|technology|development)/.test(ind);
        const showRE = isRE || (!isRE && !isSW);
        const showSW = isSW || (!isRE && !isSW);
        return (
          <>
            {showRE && <RealEstateCard />}
            {showSW && <SoftwareOutreachCard />}
            {!showRE && !showSW && (
              <p className="text-sm text-muted-foreground">No industry-specific outreach pack for “{formatIndustry(profile?.industry)}”.</p>
            )}
          </>
        );
      })()}

      <Card>
        <CardHeader>
          <CardTitle>Research Runs</CardTitle>
          <CardDescription>History of discovery runs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length === 0 && (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          )}
          {runs.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      r.status === "completed"
                        ? "default"
                        : r.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {r.status}
                  </Badge>
                  <span className="text-sm font-medium">
                    {r.query || "Untitled run"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>Found: {r.foundCount}</span>
                <span>Created: {r.createdCount}</span>
              </div>
              {r.error && <p className="mt-2 text-xs text-destructive">{r.error}</p>}
              {Array.isArray(r.results) && r.results.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-primary">
                    View {r.results.length} candidates
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs">
                    {r.results.map((c: any, i: number) => (
                      <li key={i} className="rounded bg-muted/50 px-2 py-1">
                        <span className="font-medium">{c.name}</span> — {c.company} ({c.email})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

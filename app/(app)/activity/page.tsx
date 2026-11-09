"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, RefreshCw, Bot, User, Shield, Activity as ActivityIcon } from "lucide-react";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  action: string;
  category: string;
  actorType: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: any;
  createdAt: string;
}

interface AgentRun {
  id: string;
  trigger: string;
  mode: string;
  status: string;
  steps?: any[];
  summary?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [paused, setPaused] = useState(false);
  const [operatingMode, setOperatingMode] = useState("AI_WITH_APPROVAL");
  const [live, setLive] = useState(true);
  const [running, setRunning] = useState(false);
  const [actorFilter, setActorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lastRun, setLastRun] = useState<null | {
    status: string;
    summary: string;
    metrics: Record<string, number>;
    steps: Array<{ step: string; status: string; detail?: string }>;
  }>(null);
  const lastSince = useRef<string | null>(null);

  const loadStatus = async () => {
    const res = await fetch("/api/v1/agent/takeover");
    if (res.ok) {
      const d = await res.json();
      setPaused(!!d.automationPaused);
      setOperatingMode(d.operatingMode ?? "AI_WITH_APPROVAL");
    }
  };

  const loadRuns = async () => {
    const res = await fetch("/api/v1/agent/run");
    if (res.ok) {
      const d = await res.json();
      setRuns(Array.isArray(d.data) ? d.data : []);
    }
  };

  const loadActivity = async (since?: string) => {
    const params = new URLSearchParams({ limit: "80" });
    if (since) params.set("since", since);
    if (actorFilter !== "all") params.set("actorType", actorFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    const res = await fetch(`/api/v1/activity?${params}`);
    if (res.ok) {
      const d = await res.json();
      const rows: AuditEntry[] = d.data ?? [];
      if (since) {
        setEntries((prev) => [...rows.reverse(), ...prev].slice(0, 200));
      } else {
        setEntries(rows);
      }
      lastSince.current = d.serverTime ?? new Date().toISOString();
    }
  };

  useEffect(() => {
    loadStatus();
    loadRuns();
    loadActivity();
    const id = setInterval(() => {
      if (live) {
        loadActivity(lastSince.current ?? undefined);
        loadRuns();
      }
    }, 4000);
    return () => clearInterval(id);
  }, [live, actorFilter, categoryFilter]);

  const togglePause = async (next: boolean) => {
    setPaused(next);
    try {
      const res = await fetch("/api/v1/agent/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationPaused: next }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(next ? "AI paused — manual takeover active" : "AI resumed");
    } catch {
      setPaused(!next);
      toast.error("Could not update takeover state");
    }
  };

  const changeMode = async (mode: string) => {
    setOperatingMode(mode);
    try {
      const res = await fetch("/api/v1/agent/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatingMode: mode }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Operating mode: ${mode.replace(/_/g, " ")}`);
    } catch {
      toast.error("Could not change mode");
    }
  };

  const runWorkflow = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/v1/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxLeads: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Run failed");
      const m = data.metrics ?? {};
      const parts: string[] = [];
      if (m.leadsCreated) parts.push(`${m.leadsCreated} lead(s) created`);
      if (m.leadsQualified) parts.push(`${m.leadsQualified} qualified`);
      if (m.emailsDrafted) parts.push(`${m.emailsDrafted} email(s) drafted`);
      if (m.emailsSent) parts.push(`${m.emailsSent} sent`);
      if (m.emailsPendingApproval) parts.push(`${m.emailsPendingApproval} awaiting approval`);
      if (m.meetingsProposed) parts.push(`${m.meetingsProposed} meeting(s) proposed`);
      if (m.followupsHandled) parts.push(`${m.followupsHandled} follow-up(s) handled`);
      if (data.status === "paused") {
        toast.info(data.summary || "AI is paused — manual takeover active");
      } else if (data.status === "failed") {
        toast.error(data.summary || "Workflow failed");
      } else if (parts.length) {
        toast.success(`AI finished — ${parts.join(" · ")}`);
      } else if (data.summary) {
        toast.success(`Workflow completed: ${data.summary.slice(0, 160)}`);
      } else {
        toast.success("Workflow completed");
      }
      setLastRun(data);
      loadRuns();
      loadActivity();
    } catch (e: any) {
      toast.error(e.message || "Workflow failed");
    } finally {
      setRunning(false);
    }
  };

  const actorIcon = (t: string) =>
    t === "ai" ? <Bot className="h-4 w-4 text-primary" /> : t === "system" ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />;

  return (
    <div className="space-y-6">
      {lastRun && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold">
                AI {lastRun.status === "completed" ? "finished" : lastRun.status}
                {lastRun.metrics?.leadsCreated ? ` — ${lastRun.metrics.leadsCreated} lead(s) created` : ""}
                {lastRun.metrics?.leadsQualified ? `, ${lastRun.metrics.leadsQualified} qualified` : ""}
                {lastRun.metrics?.emailsSent ? `, ${lastRun.metrics.emailsSent} email(s) sent` : ""}
              </span>
              <Button size="sm" variant="outline" onClick={() => setLastRun(null)}>
                Dismiss
              </Button>
            </div>
            {Array.isArray(lastRun.steps) && lastRun.steps.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {lastRun.steps.map((s: any, i: number) => (
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Live Activity</h1>
          <p className="text-muted-foreground">
            Track every AI action, workflow run and audit event in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={runWorkflow} disabled={running || paused}>
            <Play className="mr-2 h-4 w-4" /> {running ? "Running…" : "Run AI workflow"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => loadActivity()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Operating Mode</CardTitle>
            <CardDescription>How the AI is allowed to act</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={operatingMode} onValueChange={changeMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULLY_AI_AUTOMATED">Fully AI automated</SelectItem>
                <SelectItem value="AI_WITH_APPROVAL">AI + human approval</SelectItem>
                <SelectItem value="FULLY_MANUAL">Fully manual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {operatingMode === "FULLY_AI_AUTOMATED"
                ? "AI drafts and sends automatically."
                : operatingMode === "AI_WITH_APPROVAL"
                  ? "AI drafts; humans approve before sending."
                  : "AI is disabled; everything is manual."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Takeover</CardTitle>
            <CardDescription>Pause all AI actions immediately</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{paused ? "AI paused" : "AI active"}</p>
              <p className="text-xs text-muted-foreground">
                {paused ? "No automated actions will run." : "Automated workflow is enabled."}
              </p>
            </div>
            <Switch checked={paused} onCheckedChange={togglePause} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Feed</CardTitle>
            <CardDescription>Auto-refresh every 4s</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{live ? "Live" : "Paused"}</p>
                <p className="text-xs text-muted-foreground">{entries.length} events loaded</p>
              </div>
              <Switch checked={live} onCheckedChange={setLive} title="Pause or resume live polling" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Actor</Label>
                <Select value={actorFilter} onValueChange={setActorFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actors</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="workflow">Workflow</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                    <SelectItem value="config">Config</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="auth">Auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Activity Feed</TabsTrigger>
          <TabsTrigger value="runs">Agent Runs ({runs.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {entries.length === 0 && (
                  <p className="text-sm text-muted-foreground">No activity yet. Run the AI workflow to start.</p>
                )}
                {entries.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <span className="mt-0.5">{actorIcon(e.actorType)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{e.action}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {e.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {e.metadata && Object.keys(e.metadata).length > 0 && (
                        <pre className="mt-1 max-h-24 overflow-auto rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
                          {JSON.stringify(e.metadata, null, 1).slice(0, 600)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {runs.length === 0 && (
                <p className="text-sm text-muted-foreground">No agent runs yet.</p>
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
                      <span className="text-sm font-medium">{r.trigger} run</span>
                      <span className="text-xs text-muted-foreground">{r.mode}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.startedAt).toLocaleString()}
                    </span>
                  </div>
                  {r.summary && <p className="mt-2 text-xs text-muted-foreground">{r.summary}</p>}
                  {Array.isArray(r.steps) && r.steps.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs">
                      {r.steps.map((s: any, i: number) => (
                        <li key={i} className="flex gap-2">
                          <span
                            className={
                              s.status === "ok"
                                ? "text-emerald"
                                : s.status === "failed"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {s.status === "ok" ? "✓" : s.status === "failed" ? "✗" : "–"}
                          </span>
                          <span className="font-medium">{s.step}</span>
                          <span className="text-muted-foreground">{s.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {entries
                  .filter((e) => e.actorType === "user" || e.actorType === "system")
                  .map((e) => (
                    <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <span className="mt-0.5">{actorIcon(e.actorType)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{e.action}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {e.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(e.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

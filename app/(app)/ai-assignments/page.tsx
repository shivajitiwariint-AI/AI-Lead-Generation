"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Save,
  RefreshCw,
  Settings,
  Cpu,
  Bot,
  Target,
  FileText,
  Mail,
  Layout,
  Sparkles,
  Play,
  Loader2,
  Coins,
  Zap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AISwitchCard } from "@/components/ai-switch-card";

const MODULES: Array<{
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    key: "chatbot",
    label: "Website Chatbot",
    description: "Low-latency, cost-efficient text model",
    icon: Bot,
  },
  {
    key: "lead_extraction",
    label: "Lead Extraction",
    description: "Structured-output-capable model",
    icon: Target,
  },
  {
    key: "lead_qualification",
    label: "Lead Qualification",
    description: "Cost-efficient reasoning model",
    icon: Cpu,
  },
  {
    key: "company_research",
    label: "Company Research",
    description: "Research-capable model with approved search tools",
    icon: FileText,
  },
  {
    key: "complex_analysis",
    label: "Complex Analysis",
    description: "Strong reasoning model",
    icon: Sparkles,
  },
  {
    key: "email_drafting",
    label: "Email Drafting",
    description: "Cost-efficient text model",
    icon: Mail,
  },
  {
    key: "conversation_summary",
    label: "Conversation Summary",
    description: "Cost-efficient text model",
    icon: Layout,
  },
  {
    key: "embeddings",
    label: "Embeddings",
    description: "Dedicated embedding model/provider",
    icon: FileText,
  },
];

interface Assignment {
  moduleKey: string;
  modelId: string;
  modelKey: string;
  modelDisplayName: string;
  providerKey: string;
  providerDisplayName: string;
  fallbackModelId?: string | null;
  fallbackModelKey?: string | null;
  fallbackModelDisplayName?: string | null;
  tenantId?: string | null;
}

interface ModelOption {
  id: string;
  modelKey: string;
  displayName: string;
  providerKey: string;
  providerDisplayName: string;
}

interface TestModelRef {
  id: string;
  modelKey: string;
  displayName: string;
  providerKey: string;
  providerDisplayName: string;
  enabled: boolean;
}

type ModuleTestStatus = "working" | "fallback" | "failed" | "unassigned";

interface ModuleTestResult {
  moduleKey: string;
  status: ModuleTestStatus;
  primary: TestModelRef | null;
  fallback: TestModelRef | null;
  usedModel: TestModelRef | null;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  sample?: string;
  error?: string;
}

interface BudgetInfo {
  withinBudget: boolean;
  currentMonthCost: number;
  currentMonthTokens: number;
  budgetLimit: number;
  tokenLimit?: number | null;
  usageRatio: number;
  alertThreshold: number;
  enforce: boolean;
  remainingTokens: number | null;
  remainingCost: number | null;
  canRun: boolean;
}

interface TestResponse {
  scope: string;
  checkedAt: string;
  budget: BudgetInfo;
  summary: {
    total: number;
    working: number;
    fallback: number;
    failed: number;
    unassigned: number;
  };
  modules: ModuleTestResult[];
}

export default function AIAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedFallback, setSelectedFallback] = useState("");
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  // null = idle, "__all__" = full setup test, otherwise the module key being tested
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testSummary, setTestSummary] = useState<TestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Per-company scope (super admin can switch)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [scopeTenantId, setScopeTenantId] = useState<string | null>(null); // null = platform

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      // Detect super admin + load companies
      const compRes = await fetch("/api/v1/admin/companies").catch(() => null);
      if (compRes && compRes.ok) {
        setIsSuperAdmin(true);
        const cd = await compRes.json();
        setCompanies((cd.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
      } else {
        setIsSuperAdmin(false);
        setCompanies([]);
      }

      const [assignmentsRes, modelsRes] = await Promise.all([
        fetch("/api/v1/admin/ai/assignments"),
        fetch("/api/v1/admin/ai/models"),
      ]);
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        const isPlatform = (a: any) => a.tenantId === null || a.tenantId === undefined || a.tenantId === "platform";
        // Filter by selected scope
        const filtered =
          scopeTenantId === null
            ? data.filter(isPlatform)
            : data.filter((a: any) => a.tenantId === scopeTenantId);
        // If no tenant-specific rows, fall back to platform rows
        setAssignments(filtered.length > 0 ? filtered : data.filter(isPlatform));
      }
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        // The models API nests provider details; flatten for the assignment UI.
        setModels(
          (data as any[]).map((m) => ({
            id: m.id,
            modelKey: m.modelKey,
            displayName: m.displayName,
            providerKey: m.providerKey ?? m.provider?.providerKey ?? "",
            providerDisplayName:
              m.providerDisplayName ?? m.provider?.displayName ?? "Unknown provider",
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [scopeTenantId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    setTestSummary(null);
    setTestError(null);
  }, [scopeTenantId]);

  const summarize = (modules: ModuleTestResult[]) => ({
    total: modules.length,
    working: modules.filter((m) => m.status === "working").length,
    fallback: modules.filter((m) => m.status === "fallback").length,
    failed: modules.filter((m) => m.status === "failed").length,
    unassigned: modules.filter((m) => m.status === "unassigned").length,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        assignments: MODULES.map((mod) => {
          const existing = assignments.find((a) => a.moduleKey === mod.key);
          return {
            moduleKey: mod.key,
            modelId: selectedModel || (existing?.modelId || ""),
            fallbackModelId: selectedFallback || (existing?.fallbackModelId || null),
            tenantId: scopeTenantId, // per-company or platform (null)
          };
        }),
      };

      const res = await fetch("/api/v1/admin/ai/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditingModule(null);
        setSelectedModel("");
        setSelectedFallback("");
        // Assignment changed, so previous results are stale.
        setTestSummary(null);
        setTestError(null);
        await fetchAssignments();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error?.message || "Failed to save assignment");
      }
    } catch {
      // Error handled silently
    } finally {
      setSaving(false);
    }
  };

  const handleSelectModule = (moduleKey: string) => {
    const existing = assignments.find((a) => a.moduleKey === moduleKey);
    setEditingModule(moduleKey);
    setSelectedModel(existing?.modelId || "");
    setSelectedFallback(existing?.fallbackModelId || "");
  };

  const getModelOption = (modelId: string) =>
    models.find((m) => m.id === modelId);

  const primaryOptions = models.filter((m) => m.id !== selectedFallback);
  const fallbackOptions = models.filter((m) => m.id !== selectedModel);

  const getGroupedModels = (list: ModelOption[]) => {
    const map = new Map<string, ModelOption[]>();
    for (const m of list) {
      const key = m.providerDisplayName || m.providerKey || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  // Modules that don't have a result yet in the current view. "Test AI setup"
  // only runs these so a second click doesn't spend tokens again.
  const testedModuleKeys = new Set(
    (testSummary?.modules ?? []).map((m) => m.moduleKey)
  );
  const untestedCount = MODULES.filter(
    (m) => !testedModuleKeys.has(m.key)
  ).length;

  const applyDefaults = async () => {
    if (
      !confirm(
        "Set every module in this scope to Groq (primary) + Ollama (fallback)?"
      )
    ) {
      return;
    }
    setApplyingDefaults(true);
    try {
      const res = await fetch("/api/v1/admin/ai/assignments/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: scopeTenantId }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(d?.error?.message || "Could not apply defaults");
        return;
      }
      toast.success(
        `Defaults applied: ${d.primary.displayName} + ${d.fallback.displayName}`
      );
      setEditingModule(null);
      setTestSummary(null);
      await fetchAssignments();
    } catch {
      toast.error("Could not apply defaults");
    } finally {
      setApplyingDefaults(false);
    }
  };

  const runTest = async (moduleKey?: string) => {
    const existingModules = testSummary?.modules ?? [];

    let keys: string[];
    let testingState: string;

    if (moduleKey) {
      // Explicit single-module test always runs.
      keys = [moduleKey];
      testingState = moduleKey;
    } else {
      const tested = new Set(existingModules.map((m) => m.moduleKey));
      const pending = MODULES.map((m) => m.key).filter((k) => !tested.has(k));

      if (pending.length === 0) {
        if (
          !confirm(
            "All modules already have test results. Re-test all of them and use tokens again?"
          )
        ) {
          return;
        }
        keys = MODULES.map((m) => m.key);
      } else {
        keys = pending;
      }
      testingState = "__all__";
    }

    setTestingKey(testingState);
    setTestError(null);
    try {
      const res = await fetch("/api/v1/admin/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: scopeTenantId, moduleKeys: keys }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setTestError(d?.error?.message || "AI setup test failed");
        return;
      }

      // Merge the newly tested modules into the existing results so modules
      // that were already checked keep their last result.
      const byKey = new Map<string, ModuleTestResult>();
      for (const m of existingModules) byKey.set(m.moduleKey, m);
      for (const m of (d.modules ?? []) as ModuleTestResult[]) {
        byKey.set(m.moduleKey, m);
      }
      const modules = MODULES.map((m) => byKey.get(m.key)).filter(
        Boolean
      ) as ModuleTestResult[];

      setTestSummary({
        ...(d as TestResponse),
        modules,
        summary: summarize(modules),
      });
    } catch {
      setTestError("Could not reach the AI test endpoint");
    } finally {
      setTestingKey(null);
    }
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

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-6">
        {isSuperAdmin && <AISwitchCard />}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AI Module Assignments</h1>
            <p className="text-muted-foreground">
              Assign models to each application module. Fallback models are used when the primary is unavailable.
              {isSuperAdmin && " Scope the assignment to a specific company or leave as platform default."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              variant="outline"
              onClick={applyDefaults}
              disabled={applyingDefaults || testingKey !== null}
              title="Set every module to Groq primary + Ollama fallback"
            >
              {applyingDefaults ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {applyingDefaults ? "Applying…" : "Use Groq + Ollama defaults"}
            </Button>
            <Button
              onClick={() => runTest()}
              disabled={testingKey !== null || applyingDefaults}
            >
              {testingKey === "__all__" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {testingKey === "__all__"
                ? "Testing…"
                : testSummary
                  ? untestedCount > 0
                    ? `Test untested (${untestedCount})`
                    : "Re-test all"
                  : "Test AI setup"}
            </Button>
            {isSuperAdmin && companies.length > 0 && (
              <div className="w-64">
                <Label className="text-xs">Scope</Label>
                <Select
                  value={scopeTenantId ?? "__platform__"}
                  onValueChange={(v: any) => setScopeTenantId(v === "__platform__" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__platform__">Platform (default)</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {testError && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {testError}
            </CardContent>
          </Card>
        )}

        {testSummary && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">AI Setup Check</CardTitle>
                <CardDescription>
                  Live provider test · checked{" "}
                  {new Date(testSummary.checkedAt).toLocaleString()}
                </CardDescription>
              </div>
              <Badge
                variant={
                  testSummary.summary.total < MODULES.length
                    ? "outline"
                    : testSummary.summary.failed === 0 &&
                        testSummary.summary.unassigned === 0
                      ? "secondary"
                      : "destructive"
                }
                className="gap-1"
              >
                {testSummary.summary.total < MODULES.length ? (
                  <>
                    <AlertTriangle className="h-3 w-3" />{" "}
                    {testSummary.summary.total}/{MODULES.length} tested
                  </>
                ) : testSummary.summary.failed === 0 &&
                  testSummary.summary.unassigned === 0 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> All modules OK
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" />{" "}
                    {testSummary.summary.failed} failed ·{" "}
                    {testSummary.summary.unassigned} unassigned
                  </>
                )}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CheckMetric
                  label="Working"
                  value={`${testSummary.summary.working}/${testSummary.summary.total}`}
                  tone="text-emerald-600"
                />
                <CheckMetric
                  label="Fallback used"
                  value={String(testSummary.summary.fallback)}
                  tone="text-amber-600"
                />
                <CheckMetric
                  label="Failed"
                  value={String(testSummary.summary.failed)}
                  tone="text-destructive"
                />
                <CheckMetric
                  label="Not configured"
                  value={String(testSummary.summary.unassigned)}
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Coins className="h-4 w-4 text-muted-foreground" /> Token
                    availability
                  </div>
                  <Badge
                    variant={
                      testSummary.budget.canRun ? "secondary" : "destructive"
                    }
                    className="gap-1"
                  >
                    {testSummary.budget.canRun ? (
                      testSummary.budget.withinBudget ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Tokens available
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" /> Over budget (not
                          enforced)
                        </>
                      )
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" /> Budget limit
                        reached
                      </>
                    )}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tokens used this month
                    </p>
                    <p className="font-medium">
                      {testSummary.budget.currentMonthTokens.toLocaleString()}
                      {testSummary.budget.tokenLimit != null
                        ? ` / ${testSummary.budget.tokenLimit.toLocaleString()}`
                        : " (no limit)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tokens remaining
                    </p>
                    <p className="font-medium">
                      {testSummary.budget.remainingTokens != null
                        ? testSummary.budget.remainingTokens.toLocaleString()
                        : "Unlimited"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Cost this month
                    </p>
                    <p className="font-medium">
                      ${testSummary.budget.currentMonthCost.toFixed(4)}
                      {testSummary.budget.budgetLimit != null
                        ? ` / $${testSummary.budget.budgetLimit}`
                        : ""}
                    </p>
                  </div>
                </div>
                {testSummary.budget.tokenLimit != null && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className={
                        testSummary.budget.usageRatio >= 0.8
                          ? "h-full bg-destructive"
                          : "h-full bg-primary"
                      }
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(testSummary.budget.usageRatio * 100)
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Each module is tested with a minimal real request to its primary
                model; if that fails, the fallback is tested. “Test AI setup”
                only runs modules that have no result yet to avoid spending
                tokens twice; use “Re-test all” to refresh every module. Token
                availability is based on the configured monthly AI budget.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {MODULES.map((mod) => {
            const existing = assignments.find((a) => a.moduleKey === mod.key);
            const isEditing = editingModule === mod.key;
            const modelOpt = existing ? getModelOption(existing.modelId) : null;
            const fallbackOpt = existing?.fallbackModelId
              ? getModelOption(existing.fallbackModelId)
              : null;
            const test = testSummary?.modules.find(
              (m) => m.moduleKey === mod.key
            );

            return (
              <Card key={mod.key} className="border-l-2 border-l-primary">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <mod.icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-sm">{mod.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {mod.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {test && <ModuleStatusBadge status={test.status} />}
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runTest(mod.key)}
                        disabled={testingKey !== null || applyingDefaults}
                      >
                        {testingKey === mod.key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        <span className="ml-1">
                          {testingKey === mod.key ? "Testing…" : "Test"}
                        </span>
                      </Button>
                    )}
                    {isEditing ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {saving ? "Saving..." : "Save"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSelectModule(mod.key)}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {!isEditing && modelOpt && (
                    <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Primary Model</p>
                        <p className="text-sm font-medium">
                          {modelOpt.displayName} ({modelOpt.providerDisplayName})
                        </p>
                      </div>
                      {fallbackOpt && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Fallback</p>
                          <p className="text-sm font-medium">
                            {fallbackOpt.displayName}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {!isEditing && !modelOpt && (
                    <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                      Not configured — click Configure to assign a model
                    </div>
                  )}
                  {test && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <ModuleStatusBadge status={test.status} />
                      {test.usedModel && (
                        <span>
                          {test.usedModel.providerDisplayName} ·{" "}
                          {test.usedModel.displayName}
                        </span>
                      )}
                      {test.latencyMs != null && <span>{test.latencyMs} ms</span>}
                      {test.inputTokens != null && (
                        <span>
                          {(
                            test.inputTokens + (test.outputTokens ?? 0)
                          ).toLocaleString()}{" "}
                          tokens
                        </span>
                      )}
                      {test.error && (
                        <span className="break-words text-destructive">
                          {test.error}
                        </span>
                      )}
                    </div>
                  )}
                  {isEditing && (
                    <div className="p-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Primary Model</Label>
                        <Select value={selectedModel} onValueChange={(v: any) => setSelectedModel(v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select primary model" />
                          </SelectTrigger>
                          <SelectContent>
                            {getGroupedModels(primaryOptions).map(([provider, items]) => (
                              <SelectGroup key={provider}>
                                <SelectLabel>{provider}</SelectLabel>
                                {items.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.displayName}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                            {models.length === 0 && (
                              <SelectItem disabled value="__none__">
                                No models available. Add models first.
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Fallback Model</Label>
                        <Select
                          value={selectedFallback}
                          onValueChange={(v: any) => setSelectedFallback(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select fallback model (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No fallback</SelectItem>
                            {getGroupedModels(fallbackOptions).map(([provider, items]) => (
                              <SelectGroup key={provider}>
                                <SelectLabel>{provider}</SelectLabel>
                                {items.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.displayName}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingModule(null);
                            setSelectedModel("");
                            setSelectedFallback("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving || !selectedModel}
                        >
                          {saving ? "Saving..." : "Save Assignment"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {models.length === 0 && (
          <Card className="border border-dashed">
            <CardContent className="text-center py-8 text-muted-foreground">
              <Cpu className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No models configured yet.</p>
              <p className="text-xs mt-1">
                Go to <a href="/ai-models" className="text-primary hover:underline">AI Models</a> to add models first.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ModuleStatusBadge({ status }: { status: ModuleTestStatus }) {
  const config: Record<ModuleTestStatus, { label: string; className: string }> = {
    working: {
      label: "Working",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    },
    fallback: {
      label: "Fallback used",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    },
    failed: {
      label: "Failed",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    },
    unassigned: {
      label: "Not configured",
      className: "text-muted-foreground",
    },
  };
  const item = config[status];
  return (
    <Badge variant="outline" className={item.className}>
      {item.label}
    </Badge>
  );
}

function CheckMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold", tone)}>{value}</p>
    </div>
  );
}

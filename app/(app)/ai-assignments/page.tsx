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
  Lightbulb,
  Wand2,
  ArrowRight,
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

interface ModelHint {
  provider?: string;
  model?: string;
}

interface ModuleAdvice {
  family: string;
  reason: string;
  primary: ModelHint[];
  fallback: ModelHint[];
}

/**
 * Which model family fits each job. Hints are ordered by preference and matched
 * against provider keys / model keys already present in the AI Models catalog.
 */
const MODEL_ADVICE: Partial<Record<string, ModuleAdvice>> = {
  chatbot: {
    family: "Groq Llama / GPT-OSS or Gemini Flash",
    reason: "Needs fast, low-cost replies. Big reasoning models only add delay here.",
    primary: [
      { provider: "groq" },
      { provider: "google_gemini", model: "flash" },
      { provider: "gemini", model: "flash" },
      { provider: "openai", model: "mini" },
      { provider: "anthropic", model: "haiku" },
    ],
    fallback: [
      { provider: "ollama" },
      { provider: "groq" },
      { provider: "google_gemini", model: "flash" },
    ],
  },
  lead_extraction: {
    family: "GPT-4o-mini / Gemini Flash",
    reason: "Reliable structured output keeps extracted fields consistent and cheap.",
    primary: [
      { provider: "openai", model: "mini" },
      { provider: "openai", model: "4o" },
      { provider: "google_gemini", model: "flash" },
      { provider: "groq", model: "gpt-oss" },
      { provider: "anthropic", model: "haiku" },
    ],
    fallback: [
      { provider: "groq" },
      { provider: "ollama" },
      { provider: "google_gemini", model: "flash" },
    ],
  },
  lead_qualification: {
    family: "Groq GPT-OSS / Llama 3.3",
    reason: "Scores many leads in bulk — reasoning helps, but speed and cost matter more.",
    primary: [
      { provider: "groq", model: "gpt-oss" },
      { provider: "groq", model: "llama" },
      { provider: "google_gemini", model: "flash" },
      { provider: "openai", model: "mini" },
    ],
    fallback: [
      { provider: "ollama" },
      { provider: "groq" },
      { provider: "google_gemini", model: "flash" },
    ],
  },
  company_research: {
    family: "GPT-4o / Claude Sonnet",
    reason: "Tool use and synthesis across sources matter more than raw speed.",
    primary: [
      { provider: "openai", model: "4o" },
      { provider: "openai", model: "gpt-4.1" },
      { provider: "anthropic", model: "sonnet" },
      { provider: "google_gemini", model: "pro" },
    ],
    fallback: [
      { provider: "groq" },
      { provider: "google_gemini", model: "flash" },
      { provider: "ollama" },
    ],
  },
  complex_analysis: {
    family: "Claude Opus / Sonnet or OpenAI o-series",
    reason: "Deep reasoning for strategy and edge cases — use where quality justifies cost.",
    primary: [
      { provider: "anthropic", model: "opus" },
      { provider: "anthropic", model: "sonnet" },
      { provider: "openai", model: "o3" },
      { provider: "openai", model: "o4" },
      { provider: "openai", model: "gpt-4.1" },
      { provider: "google_gemini", model: "pro" },
      { provider: "groq", model: "gpt-oss-120b" },
    ],
    fallback: [
      { provider: "groq" },
      { provider: "google_gemini", model: "flash" },
      { provider: "openai", model: "mini" },
    ],
  },
  email_drafting: {
    family: "Claude Sonnet / Haiku or GPT-4o-mini",
    reason: "Tone and instruction-following matter; heavy reasoning models are overkill.",
    primary: [
      { provider: "anthropic", model: "sonnet" },
      { provider: "anthropic", model: "haiku" },
      { provider: "openai", model: "mini" },
      { provider: "openai", model: "4o" },
      { provider: "google_gemini", model: "flash" },
      { provider: "groq" },
    ],
    fallback: [
      { provider: "groq" },
      { provider: "ollama" },
      { provider: "google_gemini", model: "flash" },
    ],
  },
  conversation_summary: {
    family: "GPT-4o-mini / Gemini Flash",
    reason: "Short, repetitive summaries — the cheapest reliable model is the right one.",
    primary: [
      { provider: "openai", model: "mini" },
      { provider: "google_gemini", model: "flash" },
      { provider: "anthropic", model: "haiku" },
      { provider: "groq" },
    ],
    fallback: [
      { provider: "ollama" },
      { provider: "groq" },
      { provider: "google_gemini", model: "flash" },
    ],
  },
  embeddings: {
    family: "OpenAI text-embedding-3 / Ollama nomic-embed-text",
    reason: "Vector search needs a dedicated embedding model, not a chat model.",
    primary: [
      { provider: "openai", model: "embedding" },
      { provider: "google_gemini", model: "embedding" },
      { provider: "gemini", model: "embedding" },
      { provider: "voyage" },
      { provider: "ollama", model: "embed" },
    ],
    fallback: [
      { provider: "ollama", model: "embed" },
      { provider: "openai", model: "embedding" },
      { provider: "google_gemini", model: "embedding" },
    ],
  },
};

interface ModuleRecommendation {
  advice: ModuleAdvice;
  primary: ModelOption | null;
  fallback: ModelOption | null;
}

function rankByHints(model: ModelOption, hints: ModelHint[]): number {
  const provider = (model.providerKey || "").toLowerCase();
  const modelKey = (model.modelKey || "").toLowerCase();
  for (let i = 0; i < hints.length; i++) {
    const hint = hints[i];
    const providerMatch = !hint.provider || provider.includes(hint.provider);
    const modelMatch = !hint.model || modelKey.includes(hint.model);
    if (providerMatch && modelMatch) return hints.length - i;
  }
  return 0;
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
  const [applyingRecommendation, setApplyingRecommendation] = useState<string | null>(null);
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

  // Match the recommended model families against the models actually configured.
  const recommendationFor = (moduleKey: string): ModuleRecommendation | null => {
    const advice = MODEL_ADVICE[moduleKey];
    if (!advice) return null;

    const pick = (hints: ModelHint[], excludeId?: string) => {
      const best = models
        .filter((m) => m.id !== excludeId)
        .map((m) => ({ model: m, score: rankByHints(m, hints) }))
        .filter((entry) => entry.score > 0)
        .sort(
          (a, b) =>
            b.score - a.score || a.model.displayName.localeCompare(b.model.displayName)
        )[0];
      return best?.model ?? null;
    };

    const primary = pick(advice.primary);
    const fallback = pick(advice.fallback, primary?.id);
    return { advice, primary, fallback };
  };

  const saveRecommendations = async (
    entries: Array<{ moduleKey: string; primary: ModelOption; fallback: ModelOption | null }>
  ) => {
    if (entries.length === 0) {
      toast.error("No recommended model is configured. Add one in AI Models first.");
      return;
    }
    const res = await fetch("/api/v1/admin/ai/assignments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignments: entries.map((e) => ({
          moduleKey: e.moduleKey,
          modelId: e.primary.id,
          fallbackModelId: e.fallback?.id ?? null,
          tenantId: scopeTenantId,
        })),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      toast.error(d?.error?.message || "Could not apply recommendation");
      return false;
    }
    toast.success(
      entries.length === 1
        ? `Applied recommendation for ${MODULES.find((m) => m.key === entries[0].moduleKey)?.label ?? entries[0].moduleKey}`
        : `Applied ${entries.length} recommended assignments`
    );
    setEditingModule(null);
    setSelectedModel("");
    setSelectedFallback("");
    setTestSummary(null);
    setTestError(null);
    await fetchAssignments();
    return true;
  };

  const applyRecommendation = async (moduleKey: string) => {
    const rec = recommendationFor(moduleKey);
    if (!rec?.primary) {
      toast.error("No recommended model is configured. Add one in AI Models first.");
      return;
    }
    setApplyingRecommendation(moduleKey);
    try {
      await saveRecommendations([
        { moduleKey, primary: rec.primary, fallback: rec.fallback },
      ]);
    } catch {
      toast.error("Could not apply recommendation");
    } finally {
      setApplyingRecommendation(null);
    }
  };

  const useRecommendation = (moduleKey: string, fillForm: boolean) => {
    const rec = recommendationFor(moduleKey);
    if (!rec?.primary) return;
    if (fillForm) {
      setSelectedModel(rec.primary.id);
      setSelectedFallback(rec.fallback?.id ?? "");
      return;
    }
    applyRecommendation(moduleKey);
  };

  const applyAllRecommendations = async () => {
    if (
      !confirm(
        "Apply the recommended model family to every module in this scope? Existing assignments will be replaced."
      )
    ) {
      return;
    }
    const entries = MODULES.flatMap((mod) => {
      const rec = recommendationFor(mod.key);
      return rec?.primary
        ? [{ moduleKey: mod.key, primary: rec.primary, fallback: rec.fallback }]
        : [];
    });
    if (entries.length === 0) {
      toast.error("No recommended models are configured. Add models in AI Models first.");
      return;
    }
    setApplyingRecommendation("__all__");
    try {
      await saveRecommendations(entries);
    } catch {
      toast.error("Could not apply recommendations");
    } finally {
      setApplyingRecommendation(null);
    }
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
              onClick={applyAllRecommendations}
              disabled={applyingRecommendation !== null || applyingDefaults || testingKey !== null}
              title="Apply the best model family for each module"
            >
              {applyingRecommendation === "__all__" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {applyingRecommendation === "__all__"
                ? "Applying…"
                : "Apply recommendations"}
            </Button>
            <Button
              variant="outline"
              onClick={applyDefaults}
              disabled={applyingDefaults || applyingRecommendation !== null || testingKey !== null}
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
              disabled={testingKey !== null || applyingDefaults || applyingRecommendation !== null}
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

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Best model for each job
                </CardTitle>
                <CardDescription>
                  Recommended model family per module. Applying a recommendation picks the
                  closest model you have already added in AI Models.
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" /> {MODULES.length} modules
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {MODULES.map((mod) => {
                const rec = recommendationFor(mod.key);
                if (!rec) return null;
                return (
                  <div
                    key={mod.key}
                    className="rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <mod.icon className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{mod.label}</p>
                    </div>
                    <p className="mt-2 text-xs font-medium text-primary">
                      {rec.advice.family}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rec.advice.reason}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="max-w-full truncate text-[11px]">
                        {rec.primary
                          ? `${rec.primary.displayName} · ${rec.primary.providerDisplayName}`
                          : "Add a recommended model in AI Models"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Reasoning-heavy jobs (research, complex analysis) deserve larger models;
              repetitive jobs (chat, extraction, summaries, drafting) run better on
              fast, low-cost ones.
            </p>
          </CardContent>
        </Card>

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
            const rec = recommendationFor(mod.key);
            const recPrimary = rec?.primary ?? null;

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
                  {rec && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                      <div className="flex items-start gap-2 text-xs">
                        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span>
                          <span className="font-medium">Recommended:</span>{" "}
                          {recPrimary ? (
                            <>
                              {recPrimary.displayName} ({recPrimary.providerDisplayName})
                              {rec.fallback &&
                                ` · fallback ${rec.fallback.displayName}`}
                            </>
                          ) : (
                            rec.advice.family
                          )}
                          <span className="block text-muted-foreground">
                            {rec.advice.reason}
                          </span>
                        </span>
                      </div>
                      {recPrimary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => useRecommendation(mod.key, isEditing)}
                          disabled={
                            applyingRecommendation !== null ||
                            saving ||
                            applyingDefaults ||
                            testingKey !== null
                          }
                          title={
                            isEditing
                              ? "Fill the form with the recommended models"
                              : "Apply this recommendation now"
                          }
                        >
                          {applyingRecommendation === mod.key ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Wand2 className="mr-1 h-3 w-3" />
                          )}
                          {isEditing ? "Fill" : "Use recommendation"}
                        </Button>
                      )}
                    </div>
                  )}
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

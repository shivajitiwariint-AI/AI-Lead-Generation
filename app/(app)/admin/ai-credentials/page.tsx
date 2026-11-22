"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  CheckCircle2,
  Globe2,
  KeyRound,
  RefreshCw,
  Save,
  TestTube2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Scope {
  id: string;
  name: string;
  slug: string;
  status: string | null;
}

interface Provider {
  id: string;
  providerKey: string;
  displayName: string;
  enabled: boolean;
  modelCount: number;
}

interface KeyStatus {
  providerId: string;
  providerKey: string;
  scopeId: string;
  configured: boolean;
  enabled: boolean;
  source: "company" | "platform" | "environment" | "none";
  inherited: boolean;
  maskedSecret: string | null;
  lastFour: string | null;
  keyVersion: number | null;
  updatedAt: string | null;
}

interface Matrix {
  scopes: Scope[];
  providers: Provider[];
  statuses: KeyStatus[];
}

const KEY_LABELS: Record<string, { label: string; placeholder: string }> = {
  anthropic: { label: "Anthropic API key", placeholder: "sk-ant-…" },
  openai: { label: "OpenAI API key", placeholder: "sk-…" },
  google_gemini: { label: "Google AI Studio API key", placeholder: "AIza…" },
  xai_grok: { label: "xAI API key", placeholder: "xai-…" },
  groq: { label: "Groq API key", placeholder: "gsk_…" },
  ollama: { label: "Ollama base URL", placeholder: "http://localhost:11434" },
};

function statusLabel(status?: KeyStatus): string {
  if (!status) return "Not configured";
  if (!status.enabled && status.configured) return "Disabled";
  if (status.inherited) return "Inherited from global";
  if (status.source === "company") return "Company key";
  if (status.source === "platform") return "Global key";
  if (status.source === "environment") return "Environment";
  return "Not configured";
}

export default function AiCredentialsPage() {
  const [matrix, setMatrix] = useState<Matrix>({ scopes: [], providers: [], statuses: [] });
  const [scopeId, setScopeId] = useState("platform");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/ai/credentials", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not load LLM keys");
      setMatrix({
        scopes: data.scopes ?? [],
        providers: data.providers ?? [],
        statuses: data.statuses ?? [],
      });
    } catch (e: any) {
      toast.error(e.message || "Could not load LLM keys");
    }
  }, []);

  useEffect(() => {
    load();
    const requested = new URLSearchParams(window.location.search).get("tenantId");
    if (requested) setScopeId(requested);
  }, [load]);

  const scopeValue = (scope: string) => (scope === "platform" ? null : scope);
  const statusFor = (providerId: string) =>
    matrix.statuses.find((s) => s.providerId === providerId && s.scopeId === scopeId);

  const save = async (provider: Provider) => {
    const apiKey = (inputs[provider.id] || "").trim();
    if (!apiKey) {
      toast.error(`Enter ${KEY_LABELS[provider.providerKey]?.label ?? "the API key"}`);
      return;
    }
    setBusy(provider.id);
    try {
      const res = await fetch("/api/v1/admin/ai/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: provider.id, tenantId: scopeValue(scopeId), apiKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not save key");
      toast.success(`${provider.displayName} key saved (encrypted)`);
      setInputs((prev) => ({ ...prev, [provider.id]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not save key");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (provider: Provider, status: KeyStatus) => {
    setBusy(provider.id);
    try {
      const res = await fetch("/api/v1/admin/ai/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          tenantId: scopeValue(scopeId),
          enabled: !status.enabled,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not update key");
      toast.success(`${provider.displayName} key ${status.enabled ? "disabled" : "enabled"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update key");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (provider: Provider, status: KeyStatus) => {
    if (!confirm(`Remove the ${provider.displayName} key for this scope?`)) return;
    setBusy(provider.id);
    try {
      const params = new URLSearchParams({ providerId: provider.id });
      if (scopeId !== "platform") params.set("tenantId", scopeId);
      const res = await fetch(`/api/v1/admin/ai/credentials?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not remove key");
      toast.success(`${provider.displayName} key removed`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not remove key");
    } finally {
      setBusy(null);
    }
  };

  const test = async (provider: Provider) => {
    setBusy(provider.id);
    setTestResults((prev) => ({ ...prev, [provider.id]: "Testing…" }));
    try {
      const res = await fetch(`/api/v1/admin/ai/providers/${provider.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: scopeValue(scopeId) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Test failed");
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: data.success
          ? `Connected via ${data.model || "provider"} (${data.latency} ms)`
          : `Failed: ${data.error || "unknown error"}`,
      }));
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, [provider.id]: e.message || "Test failed" }));
    } finally {
      setBusy(null);
    }
  };

  const activeScope = matrix.scopes.find((s) => s.id === scopeId);
  const activeProviders = matrix.providers;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">LLM API Keys</h1>
          <p className="text-muted-foreground">
            Set encrypted keys for every language model provider, globally and per company.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[280px] flex-1 space-y-2">
            <Label htmlFor="scope">Manage keys for</Label>
            <select
              id="scope"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
            >
              {matrix.scopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                  {scope.slug === "platform" ? "" : ` (${scope.slug})`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
            {scopeId === "platform" ? (
              <Globe2 className="h-4 w-4 text-primary" />
            ) : (
              <Building2 className="h-4 w-4 text-primary" />
            )}
            {activeScope?.name ?? "Global"}
            {scopeId !== "platform" && " overrides the global key when enabled"}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {activeProviders.map((provider) => {
          const status = statusFor(provider.id);
          const label = KEY_LABELS[provider.providerKey] ?? {
            label: "API key",
            placeholder: "Paste credential",
          };
          const ownKey = status && !status.inherited && status.source !== "environment" && status.configured;

          return (
            <Card key={provider.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <div>
                      <CardTitle className="text-base">{provider.displayName}</CardTitle>
                      <CardDescription className="text-xs">
                        {provider.providerKey} · {provider.modelCount} models
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      !provider.enabled
                        ? "outline"
                        : status?.configured && status.enabled
                          ? "default"
                          : status?.configured
                            ? "secondary"
                            : "outline"
                    }
                  >
                    {provider.enabled ? statusLabel(status) : "Provider disabled"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.maskedSecret && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Stored: {status.maskedSecret}
                    {status.keyVersion ? ` · version ${status.keyVersion}` : ""}
                  </p>
                )}
                {status?.inherited && (
                  <p className="text-xs text-muted-foreground">
                    This company inherits the global key. Save a key here to override it.
                  </p>
                )}

                <div className="space-y-2">
                  <Label>{label.label}</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={status?.maskedSecret || label.placeholder}
                    value={inputs[provider.id] || ""}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(status?.enabled && status.configured)}
                      onCheckedChange={() => status && toggle(provider, status)}
                      disabled={!ownKey || busy === provider.id}
                    />
                    <span className="text-xs text-muted-foreground">Enabled</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => test(provider)}
                      disabled={busy === provider.id}
                    >
                      <TestTube2 className="mr-1 h-3.5 w-3.5" /> Test
                    </Button>
                    {ownKey && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(provider, status!)}
                        disabled={busy === provider.id}
                        title="Remove saved key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => save(provider)}
                      disabled={busy === provider.id || !(inputs[provider.id] || "").trim()}
                    >
                      <Save className="mr-1 h-3.5 w-3.5" /> Save key
                    </Button>
                  </div>
                </div>

                {testResults[provider.id] && (
                  <p className="text-xs text-muted-foreground">{testResults[provider.id]}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coverage by company</CardTitle>
          <CardDescription>
            Global keys are the fallback for every company. Company keys take precedence when enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Provider</th>
                {matrix.scopes.map((scope) => (
                  <th key={scope.id} className="py-2 pr-4 font-medium">
                    {scope.id === "platform" ? "Global" : scope.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.providers.map((provider) => (
                <tr key={provider.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{provider.displayName}</td>
                  {matrix.scopes.map((scope) => {
                    const s = matrix.statuses.find(
                      (item) => item.providerId === provider.id && item.scopeId === scope.id
                    );
                    return (
                      <td key={scope.id} className="py-2 pr-4">
                        <Badge
                          variant={
                            s?.source === "company" || (s?.source === "platform" && scope.id === "platform")
                              ? "default"
                              : s?.configured
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {statusLabel(s)}
                        </Badge>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

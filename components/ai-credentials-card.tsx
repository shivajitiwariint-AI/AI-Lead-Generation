"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { KeyRound, RefreshCw, Save, Trash2 } from "lucide-react";
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
  if (!status.configured) return "Not configured";
  if (status.inherited) return status.enabled ? "Inherited from global" : "Inherited (disabled)";
  if (!status.enabled) return "Disabled";
  if (status.source === "company") return "Company key";
  if (status.source === "platform") return "Global key";
  if (status.source === "environment") return "Environment";
  return "Configured";
}

export function AiCredentialsCard() {
  const [matrix, setMatrix] = useState<Matrix>({ scopes: [], providers: [], statuses: [] });
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // (test endpoint is admin-only; company owners can save and the platform
  // admin can validate from the admin console)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/ai-credentials", { cache: "no-store" });
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
  }, [load]);

  // Company scope is the non-platform scope returned by the API.
  const companyScopeId = matrix.scopes.find((s) => s.id !== "platform")?.id ?? null;
  const scopeId = companyScopeId ?? "platform";
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
      const res = await fetch("/api/v1/ai-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: provider.id, apiKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not save key");
      toast.success(`${provider.displayName} key saved for this workspace (encrypted)`);
      setInputs((p) => ({ ...p, [provider.id]: "" }));
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
      const res = await fetch("/api/v1/ai-credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: provider.id, enabled: !status.enabled }),
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

  const remove = async (provider: Provider) => {
    if (!confirm(`Remove the ${provider.displayName} key for this workspace?`)) return;
    setBusy(provider.id);
    try {
      const params = new URLSearchParams({ providerId: provider.id });
      const res = await fetch(`/api/v1/ai-credentials?${params.toString()}`, { method: "DELETE" });
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

  return (
    <div className="space-y-4">
      {matrix.providers.map((provider) => {
        const status = statusFor(provider.id);
        const ownKey = Boolean(status && !status.inherited && status.configured && status.source !== "environment");
        const isBusy = busy === provider.id;
        const label = KEY_LABELS[provider.providerKey] ?? { label: "API key", placeholder: "Paste credential" };

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
                <Badge variant={status?.configured && status.enabled ? "default" : "outline"}>
                  {statusLabel(status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {status?.maskedSecret && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  Stored: {status.maskedSecret}
                  {status.keyVersion ? ` · version ${status.keyVersion}` : ""}
                </p>
              )}
              {status?.inherited && (
                <p className="text-xs text-muted-foreground">
                  This workspace inherits the global key. Save a key here to override it.
                </p>
              )}
              <div className="space-y-2">
                <Label>{label.label}</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={status?.maskedSecret || label.placeholder}
                  value={inputs[provider.id] || ""}
                  onChange={(e) => setInputs((p) => ({ ...p, [provider.id]: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={Boolean(status?.enabled && status.configured)}
                    onCheckedChange={() => status && toggle(provider, status)}
                    disabled={!ownKey || isBusy}
                    title={ownKey ? "Turn this saved key on or off" : "Save a key first to enable this toggle"}
                  />
                  <span className="text-xs text-muted-foreground">Enabled</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ownKey && (
                    <Button size="sm" variant="destructive" onClick={() => remove(provider)} disabled={isBusy}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => save(provider)}
                    disabled={isBusy || !(inputs[provider.id] || "").trim()}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" /> {isBusy ? "Saving…" : "Save key"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
    </div>
  );
}

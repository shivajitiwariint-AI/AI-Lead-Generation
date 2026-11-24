"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Database,
  ExternalLink,
  Globe2,
  KeyRound,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Scope {
  id: string;
  name: string;
  slug: string;
  status: string | null;
}

interface ProviderDefinition {
  key: string;
  label: string;
  category: string;
  description: string;
  secretLabel: string;
  secondaryLabel: string | null;
  docs: string;
}

interface KeyStatus {
  providerKey: string;
  scopeId: string;
  configured: boolean;
  enabled: boolean;
  source: "tenant" | "platform" | "env" | "none";
  inherited: boolean;
  hasOverride: boolean;
  maskedSecret: string | null;
  maskedSecondary: string | null;
  keyVersion: number | null;
  updatedAt: string | null;
}

interface Matrix {
  scopes: Scope[];
  providers: ProviderDefinition[];
  statuses: KeyStatus[];
}

const PLATFORM_SCOPE = "platform";

function statusLabel(status?: KeyStatus): string {
  if (!status || !status.configured) return "Not configured";
  if (status.inherited) return status.enabled ? "Inherited from global" : "Inherited (disabled)";
  if (!status.enabled) return "Disabled";
  return "Connected";
}

function sourceLabel(status: KeyStatus | undefined, scopeId: string): string | null {
  if (!status || status.source === "none") return null;
  if (status.source === "tenant") return "Company";
  if (status.source === "platform") return scopeId === PLATFORM_SCOPE ? "Global" : "Global (inherited)";
  return "Environment";
}

export default function DataSourcesPage() {
  const [matrix, setMatrix] = useState<Matrix>({ scopes: [], providers: [], statuses: [] });
  const [scopeId, setScopeId] = useState(PLATFORM_SCOPE);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [secondaries, setSecondaries] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/data-sources", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not load data sources");
      setMatrix({
        scopes: data.scopes ?? [],
        providers: data.providers ?? [],
        statuses: data.statuses ?? [],
      });
    } catch (e: any) {
      toast.error(e.message || "Could not load data sources");
    }
  }, []);

  useEffect(() => {
    load();
    const requested = new URLSearchParams(window.location.search).get("tenantId");
    if (requested) setScopeId(requested);
  }, [load]);

  // A stale ?tenantId (deleted company) must not leave the page in a blank state.
  useEffect(() => {
    if (matrix.scopes.length && !matrix.scopes.some((s) => s.id === scopeId)) {
      setScopeId(PLATFORM_SCOPE);
    }
  }, [matrix.scopes, scopeId]);

  const scopeValue = (scope: string) => (scope === PLATFORM_SCOPE ? null : scope);
  const activeScope = matrix.scopes.find((s) => s.id === scopeId);
  const statusFor = (providerKey: string) =>
    matrix.statuses.find((s) => s.providerKey === providerKey && s.scopeId === scopeId);

  const save = async (provider: ProviderDefinition) => {
    const secret = (secrets[provider.key] || "").trim();
    if (!secret) {
      toast.error(`Enter ${provider.secretLabel}`);
      return;
    }
    setBusy(provider.key);
    try {
      const res = await fetch(`/api/v1/admin/data-sources/${provider.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          secondary: provider.secondaryLabel ? secondaries[provider.key] || null : null,
          tenantId: scopeValue(scopeId),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not save key");
      toast.success(
        `${provider.label} key saved ${scopeId === PLATFORM_SCOPE ? "globally" : "for this company"} (encrypted)`
      );
      setSecrets((prev) => ({ ...prev, [provider.key]: "" }));
      setSecondaries((prev) => ({ ...prev, [provider.key]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not save key");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (provider: ProviderDefinition, status: KeyStatus) => {
    setBusy(provider.key);
    try {
      const res = await fetch(`/api/v1/admin/data-sources/${provider.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !status.enabled, tenantId: scopeValue(scopeId) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not update source");
      toast.success(`${provider.label} ${status.enabled ? "disabled" : "enabled"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update source");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (provider: ProviderDefinition) => {
    const scopeName = scopeId === PLATFORM_SCOPE ? "the global scope" : activeScope?.name ?? "this company";
    if (!confirm(`Remove the saved ${provider.label} key for ${scopeName}?`)) return;
    setBusy(provider.key);
    try {
      const params = new URLSearchParams();
      if (scopeId !== PLATFORM_SCOPE) params.set("tenantId", scopeId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/v1/admin/data-sources/${provider.key}${suffix}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not remove key");
      toast.success(`${provider.label} key removed`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not remove key");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Data Sources</h1>
          <p className="text-muted-foreground">
            Add API keys for real business discovery, globally or per company. Keys are encrypted
            at rest and never shown again.
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
              onChange={(e) => {
                setScopeId(e.target.value);
                setSecrets({});
                setSecondaries({});
              }}
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
            {scopeId === PLATFORM_SCOPE ? (
              <Globe2 className="h-4 w-4 text-primary" />
            ) : (
              <Building2 className="h-4 w-4 text-primary" />
            )}
            {activeScope?.name ?? "Global"}
            {scopeId !== PLATFORM_SCOPE && " uses the global key unless a company key is saved"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">How it works:</strong> Google Places supplies real local
            businesses, PageSpeed and a website check find problems, and Apollo or Hunter add contact
            details. X, YouTube and Reddit are used only for intent signals. Discovered leads are saved
            as <strong className="text-foreground">unverified</strong> with no marketing consent until you
            review them.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Built-in checks:</strong> email domains are checked for a
            real mail server (MX record) and phone numbers are validated against international numbering
            metadata, so basic verification works without extra keys. A Hunter.io key adds mailbox-level
            deliverability confidence.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Global vs company:</strong> a company key overrides the
            global key only for that company. Companies without their own key inherit the global one, so
            one platform key can serve every workspace.
          </p>
          <p className="mt-2">
            LinkedIn, Justdial, IndiaMART and TradeIndia have no public API for this use, so they are not
            scraped. They are added automatically as manually approved research sources on the Research page.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {matrix.providers.map((provider) => {
          const status = statusFor(provider.key);
          const ownKey = Boolean(status?.hasOverride);
          const isBusy = busy === provider.key;

          return (
            <Card key={provider.key}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Database className="h-4 w-4" />
                    </span>
                    <div>
                      <CardTitle className="text-base">{provider.label}</CardTitle>
                      <CardDescription className="text-xs">{provider.category}</CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        status?.configured && status.enabled && !status.inherited
                          ? "default"
                          : status?.configured
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {statusLabel(status)}
                    </Badge>
                    {sourceLabel(status, scopeId) && (
                      <Badge variant="outline">{sourceLabel(status, scopeId)}</Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="mt-2">{provider.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.maskedSecret && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" /> Stored key: {status.maskedSecret}
                    {status.maskedSecondary ? ` · ${status.maskedSecondary}` : ""}
                    {status.keyVersion ? ` · version ${status.keyVersion}` : ""}
                  </p>
                )}

                {status?.inherited && (
                  <p className="text-xs text-muted-foreground">
                    This company inherits the global key. Save a key here to override it just for this
                    company.
                  </p>
                )}
                {status?.source === "env" && !status.inherited && (
                  <p className="text-xs text-muted-foreground">
                    Currently provided by an environment variable. Saving a key here overrides it.
                  </p>
                )}

                <div className="space-y-2">
                  <Label>{provider.secretLabel}</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={
                      status?.hasOverride && status.maskedSecret
                        ? status.maskedSecret
                        : scopeId === PLATFORM_SCOPE
                          ? "Paste API key"
                          : "Paste company API key (leave blank to keep global)"
                    }
                    value={secrets[provider.key] || ""}
                    onChange={(e) =>
                      setSecrets((prev) => ({ ...prev, [provider.key]: e.target.value }))
                    }
                  />
                </div>

                {provider.secondaryLabel && (
                  <div className="space-y-2">
                    <Label>{provider.secondaryLabel}</Label>
                    <Input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        status?.hasOverride && status.maskedSecondary
                          ? status.maskedSecondary
                          : "Paste client secret"
                      }
                      value={secondaries[provider.key] || ""}
                      onChange={(e) =>
                        setSecondaries((prev) => ({ ...prev, [provider.key]: e.target.value }))
                      }
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={Boolean(status?.enabled && status.configured)}
                      onCheckedChange={() => status && toggle(provider, status)}
                      disabled={!ownKey || isBusy}
                      title={
                        ownKey
                          ? "Turn this saved key on or off"
                          : "Save a key for this scope first to enable this toggle"
                      }
                    />
                    <span className="text-xs text-muted-foreground">Enabled</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={provider.docs}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Get a key <ExternalLink className="h-3 w-3" />
                    </a>
                    {ownKey && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(provider)}
                        disabled={isBusy}
                        title={
                          scopeId === PLATFORM_SCOPE
                            ? "Remove the global key"
                            : "Remove this company override"
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => save(provider)}
                      disabled={isBusy || !(secrets[provider.key] || "").trim()}
                    >
                      <Save className="mr-1 h-3.5 w-3.5" /> {isBusy ? "Saving…" : "Save key"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

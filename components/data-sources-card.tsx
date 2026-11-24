"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Database, ExternalLink, KeyRound, RefreshCw, Save, Trash2 } from "lucide-react";
import { DATA_SOURCE_PROVIDERS } from "@/lib/data-sources";
import { toast } from "sonner";

interface Status {
  key: string;
  label: string;
  category: string;
  description: string;
  secretLabel: string;
  secondaryLabel: string | null;
  docs: string;
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

export function DataSourcesCard() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [secondaries, setSecondaries] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/data-sources", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load data sources");
      const data = await res.json();
      // Merge provider definitions (labels/docs) with live status.
      const merged: Status[] = (Array.isArray(data) ? data : []).map((s: any) => {
        const def = DATA_SOURCE_PROVIDERS.find((p) => p.key === s.key);
        return {
          key: s.key,
          label: s.label ?? def?.label ?? s.key,
          category: s.category ?? def?.category ?? "",
          description: s.description ?? def?.description ?? "",
          secretLabel: s.secretLabel ?? def?.secretLabel ?? "API key",
          secondaryLabel: s.secondaryLabel ?? def?.secondaryLabel ?? null,
          docs: s.docs ?? def?.docs ?? "#",
          configured: !!s.configured,
          enabled: !!s.enabled,
          source: s.source ?? "none",
          // The company-facing status endpoint does not return the matrix-only
          // flags, so infer ownership from the resolved source.
          inherited: s.source === "platform" || s.source === "env",
          hasOverride: s.source === "tenant",
          maskedSecret: s.maskedSecret ?? null,
          maskedSecondary: s.maskedSecondary ?? null,
          keyVersion: s.keyVersion ?? null,
          updatedAt: s.updatedAt ?? null,
        };
      });
      setStatuses(merged);
    } catch (e: any) {
      toast.error(e.message || "Could not load data sources");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (s: Status) => {
    const secret = (secrets[s.key] || "").trim();
    if (!secret) {
      toast.error(`Enter ${s.secretLabel}`);
      return;
    }
    setBusy(s.key);
    try {
      const res = await fetch(`/api/v1/data-sources/${s.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          secondary: s.secondaryLabel ? secondaries[s.key] || null : null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not save key");
      toast.success(`${s.label} key saved for this workspace (encrypted)`);
      setSecrets((p) => ({ ...p, [s.key]: "" }));
      setSecondaries((p) => ({ ...p, [s.key]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not save key");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (s: Status) => {
    setBusy(s.key);
    try {
      const res = await fetch(`/api/v1/data-sources/${s.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not update source");
      toast.success(`${s.label} ${s.enabled ? "disabled" : "enabled"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update source");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (s: Status) => {
    if (!confirm(`Remove the saved ${s.label} key for this workspace?`)) return;
    setBusy(s.key);
    try {
      const res = await fetch(`/api/v1/data-sources/${s.key}`, { method: "DELETE" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not remove key");
      toast.success(`${s.label} key removed (global key will be used if available)`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not remove key");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {statuses.map((s) => {
        const ownKey = s.hasOverride;
        const isBusy = busy === s.key;
        return (
          <Card key={s.key}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{s.label}</CardTitle>
                    <CardDescription className="text-xs">{s.category}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={s.configured && s.enabled ? "default" : "outline"}>
                    {s.configured && s.enabled ? "Connected" : s.configured ? "Disabled" : "Not configured"}
                  </Badge>
                  {s.inherited && <Badge variant="secondary">Inherited from global</Badge>}
                  {!s.inherited && s.source === "env" && <Badge variant="outline">Environment</Badge>}
                </div>
              </div>
              <CardDescription className="mt-2">{s.description}</CardDescription>
              {s.inherited && (
                <p className="mt-1 text-xs text-muted-foreground">
                  This workspace uses the global key. Save a key here to override it.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {s.maskedSecret && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" /> Stored key: {s.maskedSecret}
                  {s.maskedSecondary ? ` · ${s.maskedSecondary}` : ""}
                  {s.keyVersion ? ` · version ${s.keyVersion}` : ""}
                </p>
              )}
              <div className="space-y-2">
                <Label>{s.secretLabel}</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={s.hasOverride && s.maskedSecret ? s.maskedSecret : "Paste API key"}
                  value={secrets[s.key] || ""}
                  onChange={(e) => setSecrets((p) => ({ ...p, [s.key]: e.target.value }))}
                />
              </div>
              {s.secondaryLabel && (
                <div className="space-y-2">
                  <Label>{s.secondaryLabel}</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={s.hasOverride && s.maskedSecondary ? s.maskedSecondary : "Paste client secret"}
                    value={secondaries[s.key] || ""}
                    onChange={(e) => setSecondaries((p) => ({ ...p, [s.key]: e.target.value }))}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={Boolean(s.enabled && s.configured)}
                    onCheckedChange={() => toggle(s)}
                    disabled={!ownKey || isBusy}
                    title={ownKey ? "Turn this saved key on or off" : "Save a key first to enable this toggle"}
                  />
                  <span className="text-xs text-muted-foreground">Enabled</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={s.docs}
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
                      onClick={() => remove(s)}
                      disabled={isBusy}
                      title="Remove saved key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => save(s)}
                    disabled={isBusy || !(secrets[s.key] || "").trim()}
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
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Database, ExternalLink, KeyRound, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SourceStatus {
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
  maskedSecret: string | null;
  maskedSecondary: string | null;
  keyVersion: number | null;
  updatedAt: string | null;
}

export default function DataSourcesPage() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [secondaries, setSecondaries] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/admin/data-sources", { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error?.message || "Could not load data sources");
      }
      const d = await res.json();
      setSources(d.data ?? []);
    } catch (e: any) {
      toast.error(e.message || "Could not load data sources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (source: SourceStatus) => {
    const secret = (secrets[source.key] || "").trim();
    if (!secret) {
      toast.error(`Enter ${source.secretLabel}`);
      return;
    }
    setBusy(source.key);
    try {
      const res = await fetch(`/api/v1/admin/data-sources/${source.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          secondary: source.secondaryLabel ? secondaries[source.key] || null : null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not save key");
      toast.success(`${source.label} key saved (encrypted)`);
      setSecrets((prev) => ({ ...prev, [source.key]: "" }));
      setSecondaries((prev) => ({ ...prev, [source.key]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not save key");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (source: SourceStatus) => {
    setBusy(source.key);
    try {
      const res = await fetch(`/api/v1/admin/data-sources/${source.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not update source");
      toast.success(`${source.label} ${source.enabled ? "disabled" : "enabled"}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not update source");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (source: SourceStatus) => {
    if (!confirm(`Remove the saved key for ${source.label}?`)) return;
    setBusy(source.key);
    try {
      const res = await fetch(`/api/v1/admin/data-sources/${source.key}`, {
        method: "DELETE",
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not remove key");
      toast.success(`${source.label} key removed`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Could not remove key");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Data Sources</h1>
          <p className="text-muted-foreground">
            Add API keys for real business discovery. Keys are encrypted at rest and never shown again.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

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
            LinkedIn, Justdial, IndiaMART and TradeIndia have no public API for this use, so they are not
            scraped. They are added automatically as manually approved research sources on the Research page.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {sources.map((source) => (
          <Card key={source.key}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{source.label}</CardTitle>
                    <CardDescription className="text-xs">{source.category}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={source.configured && source.enabled ? "default" : "outline"}>
                    {source.configured && source.enabled ? "Connected" : source.configured ? "Disabled" : "Not configured"}
                  </Badge>
                  {source.source !== "none" && (
                    <Badge variant="secondary" className="capitalize">
                      {source.source}
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="mt-2">{source.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {source.maskedSecret && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" /> Stored key: {source.maskedSecret}
                  {source.maskedSecondary ? ` · ${source.maskedSecondary}` : ""}
                  {source.keyVersion ? ` · version ${source.keyVersion}` : ""}
                </p>
              )}

              <div className="space-y-2">
                <Label>{source.secretLabel}</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={source.maskedSecret || "Paste API key"}
                  value={secrets[source.key] || ""}
                  onChange={(e) => setSecrets((prev) => ({ ...prev, [source.key]: e.target.value }))}
                />
              </div>

              {source.secondaryLabel && (
                <div className="space-y-2">
                  <Label>{source.secondaryLabel}</Label>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder={source.maskedSecondary || "Paste client secret"}
                    value={secondaries[source.key] || ""}
                    onChange={(e) => setSecondaries((prev) => ({ ...prev, [source.key]: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={() => toggle(source)}
                    disabled={!source.configured || busy === source.key}
                  />
                  <span className="text-xs text-muted-foreground">Enabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={source.docs}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Get a key <ExternalLink className="h-3 w-3" />
                  </a>
                  {source.source !== "env" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => remove(source)}
                      disabled={!source.configured || busy === source.key}
                      title="Remove saved key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => save(source)}
                    disabled={busy === source.key || !(secrets[source.key] || "").trim()}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" /> {busy === source.key ? "Saving…" : "Save key"}
                  </Button>
                </div>
              </div>
              {source.source === "env" && (
                <p className="text-xs text-muted-foreground">
                  Currently provided by an environment variable. Saving a key here overrides it.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Building2, Users, Globe, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Config {
  enabled: boolean;
  propertyTypes: string[];
  buyerTypes: string[];
  platforms: string[];
  keywords: string[];
  collectFields: string[];
  outreachTone: string;
  outreachMentions: string[];
  outreachRules: string[];
  maxResults: number;
}

const FULL_PROPERTY = ["flats", "apartments", "commercial properties", "office spaces", "plots", "real estate investments", "rental properties"];
const FULL_BUYERS = ["property buyers", "investors", "working professionals", "IT employees", "startup founders", "doctors", "business owners", "NRIs", "families searching for homes", "brokers", "real estate agencies"];
const FULL_PLATFORMS = ["Google Maps", "LinkedIn", "Facebook Marketplace", "99acres", "MagicBricks", "Housing.com", "IndiaMART", "Justdial", "local business directories"];
const FULL_KEYWORDS = ["looking for flats", "apartment buyers", "office buyers", "commercial property investors", "real estate investment", "property dealers", "startup office space", "companies expanding office"];
const FULL_MENTIONS = ["available flats", "investment opportunities", "premium locations", "ready-to-move properties", "commercial office spaces", "site visits", "pricing benefits"];
const FULL_RULES = ["no aggressive marketing", "no bulk spam", "no duplicate messages"];

function ToggleGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
              title={`${active ? "Remove" : "Add"}: ${o}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RealEstateCard({ tenantId }: { tenantId?: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customKeyword, setCustomKeyword] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const res = await fetch(`/api/v1/real-estate${qs}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Failed to load");
      setConfig(d?.config ?? d?.defaults ?? null);
      if (!d?.config && !d?.defaults) throw new Error("No config returned");
    } catch (e: any) {
      const msg = e.message || "Could not load Real Estate settings";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/real-estate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, config }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      setConfig(d.config);
      toast.success("Real Estate AI settings saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const k = customKeyword.trim();
    if (!k || !config) return;
    if (config.keywords.includes(k)) return;
    setConfig({ ...config, keywords: [...config.keywords, k] });
    setCustomKeyword("");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Real Estate AI
          </CardTitle>
          <CardDescription>{loadError || "Settings could not be loaded."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={load} title="Retry loading settings">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Real Estate AI
        </CardTitle>
        <CardDescription>
          Which properties to search, which buyers to target, which platforms to use, how to score and how to write outreach. AI uses this for discovery, qualification and emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Enable Real Estate mode</p>
            <p className="text-xs text-muted-foreground">Off = generic B2B search/outreach</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
            title="Enable Real Estate mode"
          />
        </div>

        <div className={cn(!config.enabled && "pointer-events-none opacity-50")}>
          <div className="space-y-5">
            <ToggleGroup
              label="Property types"
              options={FULL_PROPERTY}
              value={config.propertyTypes}
              onChange={(v) => setConfig({ ...config, propertyTypes: v })}
            />
            <ToggleGroup
              label="Buyer types"
              options={FULL_BUYERS}
              value={config.buyerTypes}
              onChange={(v) => setConfig({ ...config, buyerTypes: v })}
            />
            <ToggleGroup
              label="Platforms"
              options={FULL_PLATFORMS}
              value={config.platforms}
              onChange={(v) => setConfig({ ...config, platforms: v })}
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Search keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {config.keywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs">
                    <Search className="h-3 w-3 text-muted-foreground" />
                    {k}
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, keywords: config.keywords.filter((x) => x !== k) })}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      title={`Remove keyword: ${k}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="Add keyword, e.g. luxury villas in Pune"
                  value={customKeyword}
                  onChange={(e) => setCustomKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                />
                <Button size="sm" variant="outline" onClick={addKeyword} title="Add keyword">
                  Add
                </Button>
              </div>
            </div>
            <ToggleGroup
              label="Outreach must mention"
              options={FULL_MENTIONS}
              value={config.outreachMentions}
              onChange={(v) => setConfig({ ...config, outreachMentions: v })}
            />
            <ToggleGroup
              label="Outreach rules"
              options={FULL_RULES}
              value={config.outreachRules}
              onChange={(v) => setConfig({ ...config, outreachRules: v })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Outreach tone</label>
                <input
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={config.outreachTone}
                  onChange={(e) => setConfig({ ...config, outreachTone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Leads per search</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={String(config.maxResults)}
                  onChange={(e) => setConfig({ ...config, maxResults: Number(e.target.value) })}
                >
                  {[1, 3, 5, 10, 20].map((n) => (
                    <option key={n} value={n}>{n} leads</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <Globe className="h-4 w-4 shrink-0" />
          <span>
            AI now collects: {config.collectFields.join(", ")}. Scoring uses profession, income potential, investment capability and property intent.
          </span>
        </div>

        <Button onClick={save} disabled={saving} title="Save Real Estate AI settings">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving…" : "Save Real Estate settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

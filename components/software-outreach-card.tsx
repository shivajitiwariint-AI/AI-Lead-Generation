"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Code2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Config {
  enabled: boolean;
  services: string[];
  targetBusinesses: string[];
  platforms: string[];
  collectFields: string[];
  websiteSignals: string[];
  outreachMentions: string[];
  outreachTone: string;
  maxResults: number;
}

const FULL_SERVICES = ["website development", "admin dashboards", "ERP software", "inventory systems", "automation", "cloud deployment", "business management software"];
const FULL_BUSINESSES = ["schools", "coaching institutes", "clinics", "wholesalers", "distributors", "factories", "CA firms", "local businesses", "startups"];
const FULL_PLATFORMS = ["Google Maps", "IndiaMART", "Justdial", "LinkedIn", "TradeIndia", "business directories"];
const FULL_SIGNALS = ["outdated UI", "no mobile responsiveness", "missing dashboard/admin features", "poor performance", "no automation", "no online management system", "no inventory tracking", "no appointment system", "no ERP functionality"];
const FULL_MENTIONS = ["website modernization", "dashboard systems", "inventory management", "ERP systems", "cloud deployment", "automation services"];

function ToggleGroup({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
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
              className={cn("rounded-full border px-2.5 py-1 text-xs", active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}
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

export function SoftwareOutreachCard({ tenantId }: { tenantId?: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const res = await fetch(`/api/v1/software-outreach${qs}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Failed to load");
      setConfig(d?.config ?? d?.defaults ?? null);
      if (!d?.config && !d?.defaults) throw new Error("No config returned");
    } catch (e: any) {
      const msg = e.message || "Could not load Software settings";
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
      const res = await fetch("/api/v1/software-outreach", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, config }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      setConfig(d.config);
      toast.success("Software Outreach settings saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
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
            <Code2 className="h-4 w-4" /> Software / Business Outreach AI
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
          <Code2 className="h-4 w-4" /> Software / Business Outreach AI
        </CardTitle>
        <CardDescription>
          Which software services to sell, which businesses to target, which platforms, website problems to detect, and how to pitch. AI uses this for discovery, scoring and emails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Enable Software Outreach mode</p>
            <p className="text-xs text-muted-foreground">Off = generic search/outreach</p>
          </div>
          <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} title="Enable Software Outreach mode" />
        </div>
        <div className={cn(!config.enabled && "pointer-events-none opacity-50")}>
          <div className="space-y-5">
            <ToggleGroup label="Services to sell" options={FULL_SERVICES} value={config.services} onChange={(v) => setConfig({ ...config, services: v })} />
            <ToggleGroup label="Target businesses" options={FULL_BUSINESSES} value={config.targetBusinesses} onChange={(v) => setConfig({ ...config, targetBusinesses: v })} />
            <ToggleGroup label="Platforms" options={FULL_PLATFORMS} value={config.platforms} onChange={(v) => setConfig({ ...config, platforms: v })} />
            <ToggleGroup label="Website problems to detect" options={FULL_SIGNALS} value={config.websiteSignals} onChange={(v) => setConfig({ ...config, websiteSignals: v })} />
            <ToggleGroup label="Outreach must mention" options={FULL_MENTIONS} value={config.outreachMentions} onChange={(v) => setConfig({ ...config, outreachMentions: v })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Outreach tone</label>
                <input className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={config.outreachTone} onChange={(e) => setConfig({ ...config, outreachTone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Leads per search</label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={String(config.maxResults)} onChange={(e) => setConfig({ ...config, maxResults: Number(e.target.value) })}>
                  {[1, 3, 5, 10, 20].map((n) => (
                    <option key={n} value={n}>{n} leads</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Collects: {config.collectFields.join(", ")}. Scoring prioritizes outdated sites, missing digital systems, scaling potential and visible contact details.
        </p>
        <Button onClick={save} disabled={saving} title="Save Software Outreach settings">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving…" : "Save Software settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

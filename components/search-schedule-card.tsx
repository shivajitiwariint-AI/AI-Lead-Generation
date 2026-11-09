"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Clock3 } from "lucide-react";
import { toast } from "sonner";

interface Schedule {
  country: string;
  enabled: boolean;
  everyHours: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  dueNow: boolean;
  lastCreatedCount: number | null;
}

const PRESETS: Array<{ value: string; label: string; hours: number }> = [
  { value: "__off__", label: "Never (paused)", hours: 24 },
  { value: "1", label: "Every 1 hour", hours: 1 },
  { value: "6", label: "Every 6 hours", hours: 6 },
  { value: "12", label: "Every 12 hours", hours: 12 },
  { value: "24", label: "Every 24 hours (daily)", hours: 24 },
  { value: "48", label: "Every 2 days", hours: 48 },
  { value: "168", label: "Every 7 days (weekly)", hours: 168 },
  { value: "720", label: "Every 30 days (monthly)", hours: 720 },
];

export function SearchScheduleCard({ tenantId }: { tenantId?: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const res = await fetch(`/api/v1/search-schedules${qs}`);
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json();
      setSchedules(Array.isArray(d.schedules) ? d.schedules : []);
    } catch (e: any) {
      toast.error(e.message || "Could not load search schedules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const update = (country: string, patch: Partial<Schedule>) => {
    setSchedules((prev) => prev.map((s) => (s.country === country ? { ...s, ...patch } : s)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/search-schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          schedules: schedules.map((s) => ({
            country: s.country,
            enabled: s.enabled,
            everyHours: s.everyHours,
          })),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      setSchedules(Array.isArray(d.schedules) ? d.schedules : d.schedules);
      toast.success("Search frequencies saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString() : "Never";

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" /> AI search frequency per country
        </CardTitle>
        <CardDescription>
          How often AI searches for new leads in each country. Cron checks every 5 minutes but only hits the AI when the country is due. “Ask AI” button always searches now.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {schedules.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No countries configured yet. Add locations in onboarding or company profile, then set frequencies here.
          </p>
        )}
        {schedules.map((s) => (
          <div
            key={s.country}
            className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{s.country}</span>
                {s.dueNow && <Badge variant="secondary">Due now</Badge>}
                {!s.enabled && <Badge variant="outline">Paused</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Last: {fmt(s.lastRunAt)} · Next: {fmt(s.nextRunAt)}
                {s.lastCreatedCount != null ? ` · Last run made ${s.lastCreatedCount} lead(s)` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={s.enabled}
                onCheckedChange={(v) => update(s.country, { enabled: v })}
                title={s.enabled ? "Pause searching this country" : "Resume searching this country"}
              />
              <span className="text-xs text-muted-foreground">{s.enabled ? "On" : "Off"}</span>
            </div>
            <Select
              value={s.enabled ? String(s.everyHours) : "__off__"}
              onValueChange={(v) => {
                if (v === "__off__") update(s.country, { enabled: false });
                else update(s.country, { enabled: true, everyHours: Number(v) });
              }}
            >
              <SelectTrigger className="w-48" title={`Frequency for ${s.country}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button onClick={save} disabled={saving || schedules.length === 0} title="Save per-country search frequencies">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving…" : "Save frequencies"}
        </Button>
      </CardContent>
    </Card>
  );
}

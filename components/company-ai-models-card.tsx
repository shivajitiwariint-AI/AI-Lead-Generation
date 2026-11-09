"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Power, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  modelKey: string;
  displayName: string;
  providerKey: string;
  providerDisplayName: string;
  globalEnabled: boolean;
  tenantEnabled: boolean;
}

export function CompanyAIModelsCard({ tenantId }: { tenantId: string }) {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/v1/admin/companies/${tenantId}/ai-models`);
      if (!res.ok) return;
      const d = await res.json();
      setAiEnabled(!!d.aiEnabled);
      setRows(Array.isArray(d.models) ? d.models : []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const mutate = async (payload: any, label: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${tenantId}/ai-models`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || label);
      toast.success(label);
      await load();
    } catch (e: any) {
      toast.error(e.message || label);
    } finally {
      setSaving(false);
    }
  };

  const setMaster = (next: boolean) => {
    setAiEnabled(next);
    mutate({ aiEnabled: next }, next ? "AI enabled for this company" : "AI disabled for this company (no tokens spent)");
  };

  const toggleOne = (row: Row, enabled: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, tenantEnabled: enabled } : r)));
    mutate({ models: [{ modelId: row.id, enabled }] }, `${enabled ? "Enabled" : "Disabled"} ${row.displayName} for this company`);
  };

  return (
    <Card className={aiEnabled === false ? "border-amber-500/40 bg-amber-500/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-4 w-4" /> AI models for this company
          </CardTitle>
          <CardDescription>
            Per-company on/off. Disabled models fall back to local engine — zero tokens for this company.
          </CardDescription>
        </div>
        {aiEnabled === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={aiEnabled}
            disabled={saving}
            onCheckedChange={setMaster}
            title={aiEnabled ? "Disable AI for this company" : "Enable AI for this company"}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={saving || aiEnabled !== true}
            onClick={() => mutate({ enableAll: true }, "Enabled all models for this company")}
            title="Enable every model for this company"
          >
            <CheckCircle2 className="mr-1 h-4 w-4" /> Enable all
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving || aiEnabled !== true}
            onClick={() => mutate({ disableAll: true }, "Disabled all models for this company")}
            title="Disable every model for this company — saves tokens"
          >
            Disable all
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {aiEnabled === false ? "AI OFF — local engine only" : aiEnabled === true ? "AI ON" : "Loading…"}
          </span>
        </div>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium truncate">{r.displayName}</span>
                <Badge variant={r.tenantEnabled ? "secondary" : "outline"}>{r.tenantEnabled ? "On for company" : "Off for company"}</Badge>
                {!r.globalEnabled && <Badge variant="outline">Globally off</Badge>}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {r.providerDisplayName} · {r.modelKey}
              </p>
            </div>
            <Switch
              checked={r.tenantEnabled && (aiEnabled ?? true)}
              disabled={saving || aiEnabled !== true}
              onCheckedChange={(v) => toggleOne(r, v)}
              title={`${v_label(r)} ${r.displayName} for this company`}
            />
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No models yet.</p>}
      </CardContent>
    </Card>
  );
}

function v_label(r: Row) {
  return r.tenantEnabled ? "Disable" : "Enable";
}

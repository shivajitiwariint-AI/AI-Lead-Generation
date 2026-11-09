"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Power } from "lucide-react";
import { toast } from "sonner";

export function AISwitchCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/admin/ai/settings");
      if (res.ok) {
        const d = await res.json();
        setEnabled(!!d.aiEnabled);
      } else {
        setEnabled(true);
      }
    } catch {
      setEnabled(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled: next }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not update");
      setEnabled(!!d.aiEnabled);
      toast.success(next ? "AI enabled — workflows & chat use live models again" : "AI disabled — no provider calls, local engine only (zero tokens)");
    } catch (e: any) {
      toast.error(e.message || "Update failed");
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={enabled === false ? "border-amber-500/40 bg-amber-500/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-4 w-4" /> Global AI switch
          </CardTitle>
          <CardDescription>
            {enabled === null
              ? "Loading…"
              : enabled
                ? "AI is ON — workflows, scoring, emails and homepage chat call live models."
                : "AI is OFF — every AI call uses the free local engine. Zero tokens spent while testing."}
          </CardDescription>
        </div>
        {enabled === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={enabled}
            disabled={saving}
            onCheckedChange={toggle}
            title={enabled ? "Disable all AI (save tokens)" : "Enable all AI"}
          />
        )}
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        Off = cron workflows pause, “Ask AI”/Test calls return instantly without provider calls, homepage chat answers from public docs only.
      </CardContent>
    </Card>
  );
}

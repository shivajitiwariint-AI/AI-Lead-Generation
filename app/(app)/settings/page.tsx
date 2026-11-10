"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

function ToggleRow({
  label,
  defaultChecked = false,
}: {
  label: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex cursor-pointer items-center gap-2 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-input bg-background text-primary focus:ring-ring"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export default function SettingsPage() {
  const [mode, setMode] = useState("AI_WITH_APPROVAL");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/agent/takeover");
        if (res.ok) {
          const d = await res.json();
          setMode(d.operatingMode ?? "AI_WITH_APPROVAL");
          setPaused(!!d.automationPaused);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const updateAutomation = async (patch: { operatingMode?: string; automationPaused?: boolean }) => {
    try {
      const res = await fetch("/api/v1/agent/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setMode(d.operatingMode);
      setPaused(d.automationPaused);
      toast.success("Automation settings updated");
    } catch {
      toast.error("Could not update automation settings");
    }
  };

  const saved = (section: string) => toast.success(`${section} settings saved`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Workspace preferences, security and notifications.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>Company defaults used across the workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input id="company" placeholder="Your company name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" defaultValue="UTC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Input id="currency" defaultValue="USD" />
            </div>
            <Button variant="outline" onClick={() => saved("General")}>
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>How your team signs in and stays protected</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Session Timeout (minutes)</Label>
              <Input id="timeout" type="number" defaultValue="43200" />
            </div>
            <div className="space-y-2">
              <Label>Require MFA</Label>
              <ToggleRow label="Require multi-factor authentication" />
            </div>
            <div className="space-y-2">
              <Label>Password Policy</Label>
              <ToggleRow label="Strong password required" defaultChecked />
            </div>
            <Button variant="outline" onClick={() => saved("Security")}>
              Save Security
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose what lands in your inbox</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email Notifications</Label>
              <ToggleRow label="Enable email notifications" defaultChecked />
            </div>
            <div className="space-y-2">
              <Label>Weekly Digest</Label>
              <ToggleRow label="Send weekly activity digest" />
            </div>
            <Button variant="outline" onClick={() => saved("Notification")}>
              Save Notifications
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Automation (Requirements 2 &amp; 8)</CardTitle>
          <CardDescription>Operating mode and manual takeover</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Operating mode</Label>
            <Select value={mode} onValueChange={(v: any) => updateAutomation({ operatingMode: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULLY_AI_AUTOMATED">Fully AI automated</SelectItem>
                <SelectItem value="AI_WITH_APPROVAL">AI + human approval</SelectItem>
                <SelectItem value="FULLY_MANUAL">Fully manual</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === "FULLY_AI_AUTOMATED"
                ? "AI drafts and sends without approval."
                : mode === "AI_WITH_APPROVAL"
                  ? "AI drafts; humans approve before sending."
                  : "AI disabled; everything manual."}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Manual takeover (pause AI)</p>
              <p className="text-xs text-muted-foreground">
                {paused ? "AI is paused." : "AI is active."}
              </p>
            </div>
            <Switch checked={paused} onCheckedChange={(v) => updateAutomation({ automationPaused: v })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Per-lead takeover is also available on each lead's detail page.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data &amp; Privacy</CardTitle>
          <CardDescription>Retention, auditing and account data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="retention">Data Retention (days)</Label>
              <Input id="retention" type="number" defaultValue="365" />
            </div>
            <div className="space-y-2">
              <Label>Enable Audit Logging</Label>
              <ToggleRow label="Log all admin actions" defaultChecked />
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="destructive" onClick={() => toast.info("Export started")}>
              Export All Data
            </Button>
            <Button variant="outline" onClick={() => toast.error("Account deletion requires confirmation")}>
              Delete Account &amp; Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

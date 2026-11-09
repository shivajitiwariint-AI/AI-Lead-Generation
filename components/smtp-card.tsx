"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, Save, PlugZap } from "lucide-react";
import { toast } from "sonner";

export function SmtpCard({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [masked, setMasked] = useState("");
  const [form, setForm] = useState({
    host: "",
    port: "587",
    secure: false,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    enabled: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${tenantId}/smtp`);
      if (!res.ok) return;
      const d = await res.json();
      if (d.configured) {
        setConfigured(true);
        setMasked(d.passwordMasked ?? "");
        setForm({
          host: d.host ?? "",
          port: String(d.port ?? 587),
          secure: !!d.secure,
          username: d.username ?? "",
          password: "",
          fromEmail: d.fromEmail ?? "",
          fromName: d.fromName ?? "",
          enabled: !!d.enabled,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const set = (k: keyof typeof form) => (e: any) => {
    const v = e?.target?.checked ?? e?.target?.value ?? e;
    setForm((p) => ({ ...p, [k]: v }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${tenantId}/smtp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: form.host.trim(),
          port: Number(form.port) || 587,
          secure: form.secure,
          username: form.username.trim(),
          password: form.password.trim() || undefined,
          fromEmail: form.fromEmail.trim(),
          fromName: form.fromName.trim() || null,
          enabled: form.enabled,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      toast.success("SMTP saved");
      setForm((p) => ({ ...p, password: "" }));
      if (d.verified) toast.success("SMTP connection verified");
      else if (d.verifyError) toast.error(`Saved but verify failed: ${d.verifyError}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${tenantId}/smtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.password.trim() || undefined }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Verify failed");
      toast.success("SMTP connection verified");
    } catch (e: any) {
      toast.error(e.message || "Verify failed");
    } finally {
      setTesting(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4" /> SMTP for this company
        </CardTitle>
        <CardDescription>
          {configured
            ? `Mailbox ${form.fromEmail} is configured. Emails send from it via SMTP; falls back to Resend, then simulated. Password is stored encrypted (${masked}).`
            : "No mailbox yet — emails use Resend if configured, otherwise simulated. Add SMTP to send from the company’s own mailbox."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
          <div className="space-y-2">
            <Label>Host</Label>
            <Input value={form.host} onChange={set("host")} placeholder="smtp.gmail.com" />
          </div>
          <div className="space-y-2">
            <Label>Port</Label>
            <Input value={form.port} onChange={set("port")} placeholder="587 / 465" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={form.username} onChange={set("username")} placeholder="user@company.com" />
          </div>
          <div className="space-y-2">
            <Label>Password {configured && "(leave blank to keep saved)"}</Label>
            <Input type="password" value={form.password} onChange={set("password")} placeholder={configured ? masked : "App password"} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>From email</Label>
            <Input value={form.fromEmail} onChange={set("fromEmail")} placeholder="sales@company.com" />
          </div>
          <div className="space-y-2">
            <Label>From name (optional)</Label>
            <Input value={form.fromName} onChange={set("fromName")} placeholder="Company Sales" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.secure} onCheckedChange={(v) => setForm((p) => ({ ...p, secure: v }))} />
            SSL (port 465)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))} />
            Enabled
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving} title="Save SMTP for this company">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving…" : "Save SMTP"}
          </Button>
          <Button variant="outline" onClick={test} disabled={testing || !configured} title="Verify SMTP login">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

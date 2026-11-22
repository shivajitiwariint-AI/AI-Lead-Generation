"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface Config {
  id: string;
  tenantId: string;
  platform: string;
  name: string;
  externalAccountId: string | null;
  formIds: string[];
  appSecretSet: boolean;
  accessTokenSet: boolean;
  verifyTokenSet: boolean;
  verifyToken: string | null;
  enabled: boolean;
  updatedAt: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta / Instagram Lead Ads",
  linkedin: "LinkedIn Lead Gen Forms",
  instagram: "Instagram account (Reels)",
};

const EMPTY_FORM = {
  tenantId: "",
  platform: "meta",
  name: "",
  externalAccountId: "",
  formIds: "",
  appSecret: "",
  accessToken: "",
  verifyToken: "",
};

export default function SocialCampaignsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/social-campaigns", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not load settings");
      setCompanies(data.companies ?? []);
      setConfigs(data.configs ?? []);
      setForm((previous) =>
        previous.tenantId
          ? previous
          : { ...EMPTY_FORM, tenantId: data.companies?.[0]?.id ?? "" }
      );
    } catch (error: any) {
      toast.error(error.message || "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.tenantId) {
      toast.error("Select a company first");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Enter a name for this connection");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/social-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: form.tenantId,
          platform: form.platform,
          name: form.name.trim(),
          externalAccountId: form.externalAccountId.trim() || null,
          formIds: form.formIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          appSecret: form.appSecret || null,
          accessToken: form.accessToken || null,
          verifyToken: form.verifyToken || null,
          enabled: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not save connection");
      toast.success(
        data.verifyToken
          ? `Saved. Verify token: ${data.verifyToken}`
          : "Connection saved. Existing secrets were kept."
      );
      setForm({
        ...EMPTY_FORM,
        tenantId: form.tenantId,
        platform: form.platform,
      });
      setEditingId(null);
      await load();
    } catch (error: any) {
      toast.error(error.message || "Could not save connection");
    } finally {
      setSaving(false);
    }
  };

  const edit = (config: Config) => {
    setEditingId(config.id);
    setForm({
      tenantId: config.tenantId,
      platform: config.platform,
      name: config.name,
      externalAccountId: config.externalAccountId ?? "",
      formIds: (config.formIds ?? []).join(", "),
      appSecret: "",
      accessToken: "",
      verifyToken: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (config: Config) => {
    if (!confirm(`Remove the ${config.name} connection?`)) return;
    try {
      const res = await fetch(
        `/api/v1/admin/social-campaigns?id=${encodeURIComponent(config.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not remove connection");
      toast.success("Connection removed");
      await load();
    } catch (error: any) {
      toast.error(error.message || "Could not remove connection");
    }
  };

  const copyWebhook = async (platform: string, tenantId: string) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/api/webhooks/${platform}?tenantId=${tenantId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook URL copied");
    } catch {
      toast.error(url);
    }
  };

  const webhookPlatform = form.platform === "linkedin" ? "linkedin" : "meta";
  const webhookPreview =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/${webhookPlatform}?tenantId=${form.tenantId || "<company id>"}`
      : `/api/webhooks/${webhookPlatform}?tenantId=<company id>`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Social Integrations</h1>
          <p className="text-muted-foreground">
            Connect official lead forms. Secrets are encrypted; webhooks are signature-verified.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" />
            {editingId ? "Update connection" : "Add connection"}
          </CardTitle>
          <CardDescription>
            Use your own Meta app secret and Page access token, or your LinkedIn client secret and
            access token. Leave a secret blank to keep the saved value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={form.tenantId}
                onValueChange={(value) => setForm({ ...form, tenantId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(value) => setForm({ ...form, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Connection name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Main Meta page"
              />
            </div>
            <div className="space-y-2">
              <Label>Page ID / organization URN (optional)</Label>
              <Input
                value={form.externalAccountId}
                onChange={(e) => setForm({ ...form, externalAccountId: e.target.value })}
                placeholder="Used to route webhooks to the right company"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Form IDs (comma separated, optional)</Label>
              <Input
                value={form.formIds}
                onChange={(e) => setForm({ ...form, formIds: e.target.value })}
                placeholder="Used as an additional webhook routing hint"
              />
            </div>
            <div className="space-y-2">
              <Label>
                {form.platform === "meta"
                  ? "Meta app secret"
                  : form.platform === "linkedin"
                    ? "LinkedIn client secret"
                    : "Meta app secret"}
              </Label>
              <Input
                type="password"
                autoComplete="off"
                value={form.appSecret}
                onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                placeholder="Used to verify webhook signatures"
              />
            </div>
            <div className="space-y-2">
              <Label>Access token</Label>
              <Input
                type="password"
                autoComplete="off"
                value={form.accessToken}
                onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                placeholder={
                  form.platform === "instagram"
                    ? "Instagram Graph API token"
                    : form.platform === "meta"
                      ? "Page access token"
                      : "LinkedIn access token"
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Verify token</Label>
              <Input
                value={form.verifyToken}
                onChange={(e) => setForm({ ...form, verifyToken: e.target.value })}
                placeholder="Paste the same token into the platform webhook setup"
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <p className="flex items-center gap-2 font-medium">
              <Building2 className="h-3.5 w-3.5" /> Webhook URL
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all">{webhookPreview}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyWebhook(webhookPlatform, form.tenantId)}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save connection"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm({ ...EMPTY_FORM, tenantId: form.tenantId });
                }}
              >
                Cancel edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured connections</CardTitle>
          <CardDescription>
            Leads arrive only through signed webhooks from these official sources.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connections yet. Add one above to receive campaign leads.
            </p>
          ) : (
            configs.map((config) => {
              const company = companies.find((c) => c.id === config.tenantId);
              return (
                <div
                  key={config.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{config.name}</p>
                      <Badge variant={config.enabled ? "default" : "outline"}>
                        {PLATFORM_LABELS[config.platform] ?? config.platform}
                      </Badge>
                      {!config.enabled && <Badge variant="outline">Disabled</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {company?.name ?? config.tenantId}
                      {config.externalAccountId ? ` · ${config.externalAccountId}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className={config.appSecretSet ? "text-emerald-600" : ""}>
                        {config.appSecretSet ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : null}
                        App secret
                      </Badge>
                      <Badge variant="outline" className={config.accessTokenSet ? "text-emerald-600" : ""}>
                        {config.accessTokenSet ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : null}
                        Access token
                      </Badge>
                      <Badge variant="outline" className={config.verifyTokenSet ? "text-emerald-600" : ""}>
                        {config.verifyTokenSet ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : null}
                        Verify token
                      </Badge>
                    </div>
                    {config.verifyToken && (
                      <p className="text-xs text-muted-foreground">
                        Verify token: <code>{config.verifyToken}</code>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => edit(config)}>
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(config)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="h-3.5 w-3.5" />
        No scraping or unofficial APIs are used. Marketing consent is recorded only when the form
        explicitly provides it.
      </p>
    </div>
  );
}

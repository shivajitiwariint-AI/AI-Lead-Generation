"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  Users,
  Target,
  Mail,
  Calendar,
  DollarSign,
  KeyRound,
  ArrowLeft,
  Save,
  Activity,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { SearchScheduleCard } from "@/components/search-schedule-card";
import { RealEstateCard } from "@/components/real-estate-card";
import { SoftwareOutreachCard } from "@/components/software-outreach-card";
import { CompanyAIModelsCard } from "@/components/company-ai-models-card";
import { SmtpCard } from "@/components/smtp-card";
import { toast } from "sonner";
import { formatIndustry } from "@/lib/industry";

const MODULES = [
  { key: "leads", label: "Leads" },
  { key: "pipeline", label: "Pipeline" },
  { key: "campaigns", label: "Campaigns" },
  { key: "conversations", label: "Conversations" },
  { key: "chatbots", label: "Chatbots" },
  { key: "knowledge-base", label: "Knowledge Base" },
  { key: "follow-ups", label: "Follow-ups" },
  { key: "reports", label: "Reports" },
  { key: "integrations", label: "Integrations" },
  { key: "team", label: "Team" },
  { key: "ai", label: "AI Management" },
  { key: "scoring-profiles", label: "Scoring Profiles" },
  { key: "company", label: "Company" },
  { key: "research", label: "Research" },
  { key: "emails", label: "Emails" },
  { key: "activity", label: "Activity" },
  { key: "settings", label: "Settings" },
];

interface CompanyDetail {
  company: any;
  profile: any;
  members: any[];
  progress: any;
  recentActivity: any[];
}

export default function AdminCompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [status, setStatus] = useState("ACTIVE");
  const [mode, setMode] = useState("AI_WITH_APPROVAL");
  const [paused, setPaused] = useState(false);
  const [enabled, setEnabled] = useState<string[]>(MODULES.map((m) => m.key));

  const [newPassword, setNewPassword] = useState("");
  const [resetTarget, setResetTarget] = useState("");
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async (opts?: { silent?: boolean }) => {
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}`, { cache: "no-store" });
      if (!res.ok) {
        if (!opts?.silent) toast.error("Failed to load company");
        return;
      }
      const d = await res.json();
      setData(d);
      setLastUpdated(new Date().toLocaleTimeString());
      setStatus(d.company.status);
      setMode(d.company.operatingMode);
      setPaused(d.company.automationPaused);
      const em = d.company.enabledModules;
      setEnabled(Array.isArray(em) ? em : MODULES.map((m) => m.key));
      if (d.members?.length) setResetTarget(d.members[0].userId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Live stats: refresh every 15s so counts never go stale while you work
    const t = setInterval(() => load({ silent: true }), 15000);
    return () => clearInterval(t);
  }, [id]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          operatingMode: mode,
          automationPaused: paused,
          enabledModules: enabled,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Company settings updated");
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, userId: resetTarget || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error?.message || "Reset failed");
      toast.success("Password reset successfully");
      setNewPassword("");
    } catch (e: any) {
      toast.error(e.message || "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const deleteCompany = async () => {
    if (!confirm(`Delete company "${data?.company?.name}"? This removes all its data (leads, emails, users, AI usage). This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error?.message || "Delete failed");
      toast.success("Company deleted");
      router.push("/admin/companies");
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const toggleModule = (key: string) => {
    setEnabled((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!data) return null;

  const { company, profile, members, progress, recentActivity } = data;
  

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/companies")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{company.name}</h1>
          <p className="text-muted-foreground">
            {formatIndustry(profile?.industry)} · {company.slug} · {company.status}
            {lastUpdated ? ` · Updated ${lastUpdated}` : ""}
          </p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => load()} title="Refresh stats now">
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leads" value={progress.leads} icon={<Target className="h-4 w-4" />} subtitle="Total leads in {company.slug}" />
        <StatCard label="Qualified" value={progress.qualified} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Won" value={progress.won} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Users" value={members.length} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Emails sent" value={progress.emailsSent} icon={<Mail className="h-4 w-4" />} />
        <StatCard label="Meetings" value={progress.meetings} icon={<Calendar className="h-4 w-4" />} />
        <StatCard label="Conversations" value={progress.conversations} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="AI spend" value={`$${progress.aiCost.toFixed(4)}`} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company settings</CardTitle>
            <CardDescription>Status, operating mode, automation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="TRIAL">Trial</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operating mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULLY_AI_AUTOMATED">Fully AI automated</SelectItem>
                  <SelectItem value="AI_WITH_APPROVAL">AI + human approval</SelectItem>
                  <SelectItem value="FULLY_MANUAL">Fully manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Pause automation</p>
                <p className="text-xs text-muted-foreground">{paused ? "AI paused" : "AI active"}</p>
              </div>
              <Switch checked={paused} onCheckedChange={setPaused} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module access</CardTitle>
            <CardDescription>Enable or disable modules for this company</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                  <Switch
                    checked={enabled.includes(m.key)}
                    onCheckedChange={() => toggleModule(m.key)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={saveSettings} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company members</CardTitle>
          <CardDescription>Reset a member's password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.length === 0 && <p className="text-sm text-muted-foreground">No members.</p>}
          <div className="space-y-2">
            {members.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email} · {m.role}</p>
                </div>
                <Badge variant={m.status === "ACTIVE" ? "default" : "outline"}>{m.status}</Badge>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Reset password for</Label>
            <Select value={resetTarget} onValueChange={setResetTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m: any) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name} ({m.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button onClick={resetPassword} disabled={resetting || !newPassword || !resetTarget}>
                <KeyRound className="mr-1 h-4 w-4" /> {resetting ? "Resetting…" : "Reset"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(() => {
        const ind = (profile?.industry ?? "").toLowerCase();
        const isRE = /real/.test(ind);
        const isSW = /(software|it|agency|technology|development)/.test(ind);
        const showRE = isRE || (!isRE && !isSW);
        const showSW = isSW || (!isRE && !isSW);
        return (
          <>
            <CompanyAIModelsCard tenantId={id} />
            <SmtpCard tenantId={id} />
            <SearchScheduleCard tenantId={id} />
            {showRE && <RealEstateCard tenantId={id} />}
            {showSW && <SoftwareOutreachCard tenantId={id} />}
            {!showRE && !showSW && (
              <p className="text-sm text-muted-foreground">
                No industry-specific outreach pack for “{formatIndustry(profile?.industry)}”. Update Industry in onboarding to enable Real Estate or Software AI.
              </p>
            )}
          </>
        );
      })()}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Delete this company</p>
              <p className="text-xs text-muted-foreground">
                Removes the company and all its data. Cannot be undone.
              </p>
            </div>
            <Button variant="destructive" onClick={deleteCompany} disabled={deleting}>
              <Trash2 className="mr-1 h-4 w-4" /> {deleting ? "Deleting…" : "Delete company"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, subtitle }: { label: string; value: string | number; icon: React.ReactNode; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

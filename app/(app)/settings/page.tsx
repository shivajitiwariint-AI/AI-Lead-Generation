"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Plug, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatIndustry } from "@/lib/industry";

interface Profile {
  industry?: string | null;
  website?: string | null;
  description?: string | null;
  onboardingCompleted?: boolean;
}

export default function SettingsPage() {
  const [mode, setMode] = useState("AI_WITH_APPROVAL");
  const [paused, setPaused] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, t] = await Promise.all([
          fetch("/api/v1/company-profile").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/v1/team/members").then((r) => (r.ok ? r.json() : null)),
        ]);
        setProfile(p ?? null);
        setMemberCount(Array.isArray(t?.data) ? t.data.length : null);
      } catch {
        /* ignore */
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Workspace configuration and AI behaviour.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Company profile
            </CardTitle>
            <CardDescription>Used by the AI to qualify and match leads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loadingProfile ? (
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Industry</span>
                  <span className="font-medium">{formatIndustry(profile?.industry)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Website</span>
                  {profile?.website ? (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-primary hover:underline"
                    >
                      {profile.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Onboarding</span>
                  {profile?.onboardingCompleted ? (
                    <Badge variant="secondary">Complete</Badge>
                  ) : (
                    <Badge variant="outline">Incomplete</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild className="mt-1 w-full">
                  <Link href="/company" className="flex items-center justify-center gap-1">
                    Edit company profile <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Team
            </CardTitle>
            <CardDescription>People with access to this workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active members</span>
              <span className="font-medium">{memberCount ?? "—"}</span>
            </div>
            <Button variant="outline" size="sm" asChild className="mt-1 w-full">
              <Link href="/team" className="flex items-center justify-center gap-1">
                Manage team <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" /> Integrations
            </CardTitle>
            <CardDescription>Connect email, chat and data sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Email delivery uses your company SMTP when configured, otherwise the platform mailer.
            </p>
            <Button variant="outline" size="sm" asChild className="mt-1 w-full">
              <Link href="/integrations" className="flex items-center justify-center gap-1">
                View integrations <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" /> AI Automation
          </CardTitle>
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
              <p className="text-xs text-muted-foreground">{paused ? "AI is paused." : "AI is active."}</p>
            </div>
            <Switch checked={paused} onCheckedChange={(v) => updateAutomation({ automationPaused: v })} />
          </div>
          <p className="text-xs text-muted-foreground">
            Per-lead takeover is also available on each lead&apos;s detail page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

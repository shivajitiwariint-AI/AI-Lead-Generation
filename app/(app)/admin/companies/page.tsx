"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Target, Mail, Calendar, DollarSign, Eye, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  operatingMode: string;
  automationPaused: boolean;
  industry: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  stats: {
    users: number;
    leads: number;
    qualified: number;
    won: number;
    emailsSent: number;
    meetings: number;
    aiCost: number;
  };
}

export default function AdminCompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/v1/admin/companies");
      if (res.ok) {
        const d = await res.json();
        setCompanies(d.data ?? []);
      } else {
        toast.error("Failed to load companies");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Company Management</h1>
        <p className="text-muted-foreground">
          Super admin view: review and manage all registered companies.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total companies" value={companies.length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Active" value={companies.filter((c) => c.status === "ACTIVE").length} icon={<CheckIcon />} />
        <StatCard label="Total leads" value={companies.reduce((a, c) => a + c.stats.leads, 0)} icon={<Target className="h-4 w-4" />} />
      </div>

      <div className="space-y-3">
        {companies.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">No companies yet.</CardContent>
          </Card>
        )}
        {companies.map((c) => (
          <Card key={c.id} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">{c.name}</h3>
                    <Badge variant={c.status === "ACTIVE" ? "default" : "outline"}>{c.status}</Badge>
                    {c.onboardingCompleted ? (
                      <Badge variant="secondary">Onboarded</Badge>
                    ) : (
                      <Badge variant="outline">Onboarding pending</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.industry || "—"} · {c.slug} · joined {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mode: {c.operatingMode.replace(/_/g, " ")} {c.automationPaused ? "· PAUSED" : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => router.push(`/admin/companies/${c.id}`)}>
                  <Eye className="mr-1 h-4 w-4" /> Manage
                </Button>
                <Button
                  size="sm"
                  variant={c.status === "ACTIVE" ? "outline" : "default"}
                  onClick={async () => {
                    const newStatus = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                    const res = await fetch(`/api/v1/admin/companies/${c.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: newStatus }),
                    });
                    if (res.ok) {
                      toast.success(`Company ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
                      load();
                    } else {
                      toast.error("Failed to update status");
                    }
                  }}
                >
                  {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
                    const res = await fetch(`/api/v1/admin/companies/${c.id}`, { method: "DELETE" });
                    if (res.ok) {
                      toast.success("Company deleted");
                      load();
                    } else {
                      const d = await res.json();
                      toast.error(d?.error?.message || "Delete failed");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                <MiniStat label="Users" value={c.stats.users} icon={<Users className="h-3.5 w-3.5" />} />
                <MiniStat label="Leads" value={c.stats.leads} icon={<Target className="h-3.5 w-3.5" />} />
                <MiniStat label="Qualified" value={c.stats.qualified} icon={<CheckIconSmall />} />
                <MiniStat label="Won" value={c.stats.won} icon={<CheckIconSmall />} />
                <MiniStat label="Emails" value={c.stats.emailsSent} icon={<Mail className="h-3.5 w-3.5" />} />
                <MiniStat label="Meetings" value={c.stats.meetings} icon={<Calendar className="h-3.5 w-3.5" />} />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                AI spend: ${c.stats.aiCost.toFixed(4)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}</div>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CheckIcon() {
  return <CheckCircle2 className="h-4 w-4" />;
}
function CheckIconSmall() {
  return <CheckCircle2 className="h-3.5 w-3.5" />;
}

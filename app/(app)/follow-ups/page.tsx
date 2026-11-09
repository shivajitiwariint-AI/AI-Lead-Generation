"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface FollowupTask {
  id: string;
  leadId: string;
  dueAt: string;
  status: string;
  createdAt: string;
  lead?: { id: string; name: string; company?: string | null; email?: string | null; status?: string } | null;
}

interface Stats {
  dueToday: number;
  overdue: number;
  pending: number;
  completed: number;
  canceled: number;
}

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<FollowupTask[]>([]);
  const [stats, setStats] = useState<Stats>({ dueToday: 0, overdue: 0, pending: 0, completed: 0, canceled: 0 });
  const [loading, setLoading] = useState(true);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/followups");
      if (res.ok) {
        const d = await res.json();
        setFollowups(Array.isArray(d.data) ? d.data : []);
        setStats(d.stats ?? { dueToday: 0, overdue: 0, pending: 0, completed: 0, canceled: 0 });
      } else {
        const e = await res.json().catch(() => null);
        toast.error(e?.error?.message || "Could not load follow-ups");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const act = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/followups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Follow-up ${status}`);
      fetchFollowups();
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Follow-ups</h1>
          <p className="text-muted-foreground">
            Manage scheduled follow-up tasks for your leads. Cron dispatches due tasks; AI completes them via the workflow.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="flex items-center gap-2" title="Schedule from a lead detail page">
            <Link href="/leads">
              <CalendarPlus className="h-4 w-4" /> Schedule from Lead
            </Link>
          </Button>
          <Button variant="outline" onClick={fetchFollowups}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard title="Due Today" value={stats.dueToday} color="text-amber" />
        <StatCard title="Overdue" value={stats.overdue} color="text-destructive" />
        <StatCard title="Pending" value={stats.pending} color="text-blue" />
        <StatCard title="Completed" value={stats.completed} color="text-green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up Tasks ({followups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-3 text-muted-foreground font-medium">Lead</th>
                  <th className="py-3 text-muted-foreground font-medium">Due Date</th>
                  <th className="py-3 text-muted-foreground font-medium">Status</th>
                  <th className="py-3 text-muted-foreground font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {followups.length > 0 ? (
                  followups.map((f) => (
                    <tr key={f.id} className="border-b border-border">
                      <td className="py-3">
                        <Link href={`/leads/${f.leadId}`} className="hover:underline font-medium">
                          {f.lead?.name ?? f.leadId.slice(0, 8)}
                        </Link>
                        {f.lead?.company && <span className="text-muted-foreground"> · {f.lead.company}</span>}
                      </td>
                      <td className="py-3 text-muted-foreground">{new Date(f.dueAt).toLocaleString()}</td>
                      <td className="py-3">
                        <Badge variant={f.status === "completed" ? "secondary" : f.status === "canceled" ? "destructive" : "outline"}>{f.status}</Badge>
                      </td>
                      <td className="py-3 text-right space-x-1">
                        {f.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => act(f.id, "completed")} title="Mark completed">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => act(f.id, "canceled")} title="Cancel follow-up">
                              <XCircle className="h-3 w-3 mr-1" /> Cancel
                            </Button>
                          </>
                        )}
                        {f.status !== "pending" && (
                          <Button size="sm" variant="outline" onClick={() => act(f.id, "pending")} title="Reopen follow-up">
                            <RotateCcw className="h-3 w-3 mr-1" /> Reopen
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No follow-up tasks scheduled. Schedule one from a Lead detail → Schedule Follow-up.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 card p-6">
        <h3 className="text-sm font-semibold mb-2">Follow-up Rules</h3>
        <p className="text-xs text-muted-foreground mb-4">Follow-ups automatically stop when:</p>
        <ul className="space-y-1 text-xs text-muted-foreground mb-6">
          <li>• The customer replies, opts out, or asks not to be contacted</li>
          <li>• The lead is marked won, lost, or disqualified</li>
          <li>• The campaign is paused or cancelled</li>
          <li>• The contact becomes suppressed</li>
          <li>• A company or platform limit is reached</li>
        </ul>
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 border-l-2 border-l-blue">
            <p className="text-xs font-medium">Idempotency</p>
            <p className="text-[10px] text-muted-foreground">Every follow-up uses an idempotency key to prevent duplicate sends.</p>
          </Card>
          <Card className="p-4 border-l-2 border-l-green">
            <p className="text-xs font-medium">Atomic Claims</p>
            <p className="text-[10px] text-muted-foreground">Jobs are atomically claimed to prevent concurrent duplicate execution.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

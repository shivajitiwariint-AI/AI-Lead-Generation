"use client";

import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Meeting {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string | null;
  createdBy: string;
  leadId: string;
  lead?: { id: string; name: string; company?: string | null; email?: string | null } | null;
}

function MeetingsContent() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const qs = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/v1/meetings${qs}`);
      if (res.ok) {
        const d = await res.json();
        setMeetings(Array.isArray(d.data) ? d.data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const act = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Meeting ${status}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Meetings</h1>
        <p className="text-muted-foreground">AI-proposed and manual discovery calls. Confirm to move the lead to Meeting Scheduled.</p>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {["all", "proposed", "scheduled", "completed", "canceled"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "all" ? "All" : s}
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Meetings ({meetings.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {meetings.length === 0 && <p className="text-sm text-muted-foreground">No meetings yet. AI proposes them from chats and high scores.</p>}
          {meetings.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
              <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.title} — <Link href={`/leads/${m.leadId}`} className="hover:underline">{m.lead?.name ?? m.leadId.slice(0, 8)}</Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(m.startsAt).toLocaleString()} · by {m.createdBy}
                </p>
                {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
              </div>
              <Badge variant={m.status === "scheduled" ? "default" : m.status === "canceled" ? "destructive" : "secondary"}>{m.status}</Badge>
              <div className="flex gap-1">
                {m.status === "proposed" && (
                  <Button size="sm" onClick={() => act(m.id, "scheduled")} title="Confirm meeting">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm
                  </Button>
                )}
                {m.status !== "canceled" && m.status !== "completed" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => act(m.id, "completed")} title="Mark completed">Done</Button>
                    <Button size="sm" variant="destructive" onClick={() => act(m.id, "canceled")} title="Cancel meeting">
                      <XCircle className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
      <MeetingsContent />
    </Suspense>
  );
}

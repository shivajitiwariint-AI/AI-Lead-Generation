"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

function FollowupForm() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [leadName, setLeadName] = useState("");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/leads/${id}`)
      .then((r) => r.json())
      .then((d) => d?.name && setLeadName(d.name))
      .catch(() => {});
  }, [id]);

  const schedule = async () => {
    if (!dueAt) {
      toast.error("Pick a date and time");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: new Date(dueAt).toISOString() }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not schedule follow-up");
      toast.success(`Follow-up scheduled for ${new Date(dueAt).toLocaleString()}`);
      router.push(`/leads/${id}`);
    } catch (e: any) {
      toast.error(e.message || "Could not schedule follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-xl">
      <Link href={`/leads/${id}`} className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to lead
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Schedule Follow-up</CardTitle>
          <CardDescription>
            {leadName ? `For ${leadName} — cron picks it up when due` : "Pick when AI should follow up"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Due at</Label>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(`/leads/${id}`)}>
              Cancel
            </Button>
            <Button onClick={schedule} disabled={saving} title="Schedule this follow-up">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
              {saving ? "Scheduling…" : "Schedule Follow-up"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeadFollowupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <FollowupForm />
    </Suspense>
  );
}

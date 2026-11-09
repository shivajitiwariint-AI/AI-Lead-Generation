"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const STATUSES = ["new", "unreviewed", "qualified", "contacted", "meeting_scheduled", "proposal", "won", "lost", "disqualified"];

function EditLeadForm() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    industry: "",
    location: "",
    requirement: "",
    status: "new",
  });

  useEffect(() => {
    fetch(`/api/v1/leads/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.id) {
          setForm({
            name: d.name ?? "",
            email: d.email ?? "",
            phone: d.phone ?? "",
            company: d.company ?? "",
            website: d.website ?? "",
            industry: d.industry ?? "",
            location: d.location ?? "",
            requirement: d.requirement ?? "",
            status: d.status ?? "new",
          });
        }
      })
      .catch(() => toast.error("Could not load lead"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (k: keyof typeof form) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          website: form.website.trim() || null,
          industry: form.industry.trim() || null,
          location: form.location.trim() || null,
          requirement: form.requirement.trim() || null,
          status: form.status,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      toast.success("Lead updated");
      router.push(`/leads/${id}`);
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl">
      <Link href={`/leads/${id}`} className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to lead
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Edit Lead</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={set("name")} placeholder="e.g. Rahul Sharma" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="rahul@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={form.company} onChange={set("company")} placeholder="ABC Technologies" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={set("website")} placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={form.industry} onChange={set("industry")} placeholder="Software and IT" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={set("location")} placeholder="Pune, India" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Requirement / Notes</Label>
            <textarea
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              value={form.requirement}
              onChange={set("requirement")}
              placeholder="Property interest, budget, needs..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.push(`/leads/${id}`)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} title="Save lead changes">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving…" : "Save Lead"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EditLeadPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <EditLeadForm />
    </Suspense>
  );
}

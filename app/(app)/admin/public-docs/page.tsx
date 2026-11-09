"use client";

import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Doc {
  id: string;
  title: string;
  keywords: string[];
  content: string;
  enabled: boolean;
  updatedAt: string;
}

const splitKeywords = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30);

function DocsContent() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", keywords: "", content: "", enabled: true });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/public-docs");
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json();
      setDocs(Array.isArray(d.data) ? d.data : []);
    } catch (e: any) {
      toast.error(e.message || "Could not load docs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.title.trim() || form.content.trim().length < 50) {
      toast.error("Title required and content must be at least 50 characters");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/public-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          keywords: splitKeywords(form.keywords),
          content: form.content.trim(),
          enabled: form.enabled,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Create failed");
      toast.success("Doc created");
      setForm({ title: "", keywords: "", content: "", enabled: true });
      load();
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const updateDoc = async (id: string, patch: Partial<Doc>) => {
    try {
      const res = await fetch(`/api/v1/admin/public-docs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Update failed");
      setDocs((prev) => prev.map((x) => (x.id === id ? { ...x, ...d } : x)));
    } catch (e: any) {
      toast.error(e.message || "Update failed");
      load();
    }
  };

  const removeDoc = async (id: string, title: string) => {
    if (!confirm(`Delete public doc "${title}"? The homepage assistant will stop using it.`)) return;
    try {
      const res = await fetch(`/api/v1/admin/public-docs/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Delete failed");
      toast.success("Doc deleted");
      load();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> New public doc
          </CardTitle>
          <CardDescription>
            Only approved public content. Never add API keys, credentials, architecture, or behind-login internals — the assistant is strictly public-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Pricing and demo" />
            </div>
            <div className="space-y-2">
              <Label>Keywords (comma-separated)</Label>
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="price, pricing, cost, demo, trial" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Content (public, at least 50 characters)</Label>
            <textarea
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[110px]"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="What visitors should know about this topic…"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              Enabled (assistant can use it)
            </label>
            <Button onClick={create} disabled={saving} title="Create public doc">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving…" : "Create doc"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {docs.length === 0 && <p className="text-sm text-muted-foreground">No docs yet. Create the first one above.</p>}
        {docs.map((d) => (
          <Card key={d.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium"
                  value={d.title}
                  onChange={(e) => setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, title: e.target.value } : x)))}
                  onBlur={(e) => updateDoc(d.id, { title: e.target.value })}
                  title="Title (edits on blur)"
                />
                <Badge variant={d.enabled ? "secondary" : "outline"}>{d.enabled ? "Enabled" : "Disabled"}</Badge>
                <Switch
                  checked={d.enabled}
                  onCheckedChange={(v) => {
                    setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, enabled: v } : x)));
                    updateDoc(d.id, { enabled: v });
                  }}
                  title={d.enabled ? "Disable this doc" : "Enable this doc"}
                />
                <Button size="sm" variant="destructive" onClick={() => removeDoc(d.id, d.title)} title="Delete this doc">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
                value={(d.keywords ?? []).join(", ")}
                onChange={(e) => setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, keywords: splitKeywords(e.target.value) } : x)))}
                onBlur={(e) => updateDoc(d.id, { keywords: splitKeywords(e.target.value) })}
                placeholder="keywords, comma, separated"
                title="Keywords used for retrieval (edits on blur)"
              />
              <textarea
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[90px]"
                value={d.content}
                onChange={(e) => setDocs((prev) => prev.map((x) => (x.id === d.id ? { ...x, content: e.target.value } : x)))}
                onBlur={(e) => updateDoc(d.id, { content: e.target.value })}
                title="Content (edits on blur)"
              />
              <p className="text-xs text-muted-foreground">Updated {new Date(d.updatedAt).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AdminPublicDocsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Public Knowledge Base</h1>
          <p className="text-muted-foreground">
            Manage the approved docs the homepage RAG assistant can use. Enabled docs are retrieved live — no deploy needed.
          </p>
        </div>
        <DocsContent />
      </div>
    </Suspense>
  );
}

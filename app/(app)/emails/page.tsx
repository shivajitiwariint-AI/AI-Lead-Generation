"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send, Check, X, Edit3, Plus, Sparkles, Bold, Italic, Underline, Link2, List } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";

function renderMiniMd(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/__(.+?)__/g, "<u>$1</u>").replace(/\n/g, "<br/>");
}

function MiniEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const wrap = (before: string, after: string, fallback = "text") => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.slice(s, e) || fallback;
    onChange(`${value.slice(0, s)}${before}${sel}${after}${value.slice(e)}`);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const insertLine = (prefix: string) => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const s = ta.selectionStart;
    onChange(`${value.slice(0, s)}${prefix}${value.slice(s)}`);
    requestAnimationFrame(() => ta.focus());
  };
  const insertLink = () => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const url = window.prompt("Paste link URL (https://…)");
    if (!url) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.slice(s, e) || "link text";
    onChange(`${value.slice(0, s)}${sel} (${url})${value.slice(e)}`);
    requestAnimationFrame(() => ta.focus());
  };
  const tools = [
    { icon: Bold, label: "Bold", action: () => wrap("**", "**") },
    { icon: Italic, label: "Italic", action: () => wrap("*", "*") },
    { icon: Underline, label: "Underline", action: () => wrap("__", "__") },
    { icon: List, label: "Bullet", action: () => insertLine("\n• ") },
    { icon: Link2, label: "Insert link", action: insertLink },
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-muted/20 p-1.5">
        {tools.map((t) => (
          <button key={t.label} type="button" onClick={t.action} disabled={disabled} title={t.label} aria-label={t.label} className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted disabled:opacity-50">
            <t.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => setPreview((p) => !p)} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted" title="Toggle preview">
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMiniMd(value) }} />
      ) : (
        <Textarea ref={ref} value={value} onChange={(e: any) => onChange(e.target.value)} rows={12} disabled={disabled} />
      )}
    </div>
  );
}

interface Email {
  id: string;
  leadId?: string | null;
  subject?: string | null;
  body?: string | null;
  toAddress?: string | null;
  status: string;
  generatedBy?: string;
  createdAt: string;
  meta?: any;
}

interface Lead { id: string; name: string; company?: string | null; email?: string | null; }

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  sent: "default",
  approved: "secondary",
  pending_review: "outline",
  draft: "outline",
  rejected: "destructive",
  failed: "destructive",
};

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Email | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [genLead, setGenLead] = useState("");
  const [genPurpose, setGenPurpose] = useState<"intro" | "follow_up">("intro");
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    const [e, l] = await Promise.all([
      fetch(`/api/v1/emails?${params}`).then((r) => r.json()),
      fetch("/api/v1/leads?limit=100").then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    setEmails(Array.isArray(e?.data) ? e.data : []);
    setLeads(Array.isArray(l?.data) ? l.data : []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [filter]);

  const openEmail = (e: Email) => {
    setSelected(e);
    setEditSubject(e.subject ?? "");
    setEditBody(e.body ?? "");
  };

  const generate = async () => {
    if (!genLead) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: genLead, purpose: genPurpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Generate failed");
      toast.success(`Email drafted (${data.status})`);
      setGenLead("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/emails/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated = await res.json();
      setSelected(updated);
      toast.success("Email updated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const act = async (action: "approve" | "reject" | "send") => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const url =
        action === "approve"
          ? `/api/v1/emails/${selected.id}/approve`
          : action === "reject"
            ? `/api/v1/emails/${selected.id}/reject`
            : `/api/v1/emails/${selected.id}/send`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: "Rejected by reviewer" } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Action failed");
      toast.success(`Email ${action === "send" ? "sent" : action + "d"}`);
      setSelected(data.message ?? data);
      if (data.message) {
        setEditSubject(data.message.subject ?? editSubject);
        setEditBody(data.message.body ?? editBody);
      }
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Email Management</h1>
        <p className="text-muted-foreground">
          AI drafts emails; you review, edit, approve or reject before sending.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Generate with AI
          </CardTitle>
          <CardDescription>Draft an outreach email for a lead</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>Lead</Label>
            <Select value={genLead} onValueChange={setGenLead}>
              <SelectTrigger>
                <SelectValue placeholder="Select a lead" />
              </SelectTrigger>
              <SelectContent>
                {leads
                  .filter((l) => l.email)
                  .map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} {l.company ? `· ${l.company}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40 space-y-2">
            <Label>Purpose</Label>
            <Select value={genPurpose} onValueChange={(v: any) => setGenPurpose(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intro">Introduction</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={!genLead || generating}>
            <Plus className="mr-2 h-4 w-4" /> {generating ? "Drafting…" : "Generate"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {["all", "pending_review", "draft", "approved", "sent", "rejected"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emails ({emails.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {emails.length === 0 && (
              <p className="text-sm text-muted-foreground">No emails yet.</p>
            )}
            {emails.map((e) => (
              <button
                key={e.id}
                onClick={() => openEmail(e)}
                className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
                  selected?.id === e.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{e.subject || "(no subject)"}</span>
                  <Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>{e.status}</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {e.toAddress} · {new Date(e.createdAt).toLocaleString()}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review &amp; Edit</CardTitle>
            <CardDescription>
              {selected ? selected.status : "Select an email"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select an email to review.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input value={selected.toAddress ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={editSubject} onChange={(e: any) => setEditSubject(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <MiniEditor value={editBody} onChange={setEditBody} disabled={selected.status === "sent"} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={saveEdit} disabled={actionLoading}>
                    <Edit3 className="mr-1 h-4 w-4" /> Save edits
                  </Button>
                  {(selected.status === "pending_review" || selected.status === "draft") && (
                    <>
                      <Button size="sm" onClick={() => act("approve")} disabled={actionLoading}>
                        <Check className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => act("reject")} disabled={actionLoading}>
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                  {selected.status === "approved" && (
                    <Button size="sm" onClick={() => act("send")} disabled={actionLoading}>
                      <Send className="mr-1 h-4 w-4" /> Send
                    </Button>
                  )}
                  {selected.status === "sent" && (
                    <Badge variant="default">Sent {selected.meta?.simulated ? "(simulated)" : ""}</Badge>
                  )}
                </div>
                {selected.meta?.mock && (
                  <p className="text-xs text-muted-foreground">
                    Drafted by local engine (no provider key configured).
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

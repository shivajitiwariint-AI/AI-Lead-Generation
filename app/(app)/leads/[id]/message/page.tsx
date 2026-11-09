"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, CheckCircle2, XCircle, Send, Paperclip, Globe, Trash2, Plus, Bold, Italic, Underline, List, Link2, Heading2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  requirement?: string | null;
}

interface Draft {
  messageId: string;
  status: string;
  approvalRequired: boolean;
  subject: string;
  body: string;
  mode?: string;
}

function renderMiniMd(text: string) {
  // minimal markdown: **bold**, *italic*, __underline__, line breaks
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\n/g, "<br/>");
}

function MiniEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const wrap = (before: string, after: string, fallback = "text") => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${sel}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + sel.length);
    });
  };

  const insertLine = (prefix: string) => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const next = `${value.slice(0, start)}${prefix}${value.slice(start)}`;
    onChange(next);
    requestAnimationFrame(() => ta.focus());
  };

  const insertLink = () => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const url = window.prompt("Paste link URL (https://…)");
    if (!url) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end) || "link text";
    const next = `${value.slice(0, start)}${sel} (${url})${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => ta.focus());
  };

  const tools = [
    { icon: Bold, label: "Bold", action: () => wrap("**", "**") },
    { icon: Italic, label: "Italic", action: () => wrap("*", "*") },
    { icon: Underline, label: "Underline", action: () => wrap("__", "__") },
    { icon: Heading2, label: "Heading", action: () => insertLine("\n\n") },
    { icon: List, label: "Bullet", action: () => insertLine("\n• ") },
    { icon: Link2, label: "Insert link", action: insertLink },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-muted/20 p-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.action}
            disabled={disabled}
            title={t.label}
            aria-label={t.label}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted disabled:opacity-50"
          >
            <t.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          title="Toggle preview"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div
          className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMiniMd(value) }}
        />
      ) : (
        <textarea
          ref={ref}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
      <p className="text-[11px] text-muted-foreground">Styles: **bold**, *italic*, __underline__. Preview shows how the email will look.</p>
    </div>
  );
}

function MessageForm() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [purpose, setPurpose] = useState<"intro" | "follow_up">("intro");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [website, setWebsite] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [l, h, p] = await Promise.all([
        fetch(`/api/v1/leads/${id}`).then((r) => r.json()),
        fetch(`/api/v1/emails?leadId=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null),
        fetch("/api/v1/company-profile").then((r) => r.json()).catch(() => null),
      ]);
      if (l?.id) setLead(l);
      setHistory(Array.isArray((h as any)?.data) ? (h as any).data : []);
      setWebsite((p as any)?.website ?? "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const generate = async () => {
    if (!lead?.email) {
      toast.error("Lead has no email — add one first via Edit Lead");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id, purpose, attachments: attachments.length ? attachments : undefined }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Generate failed");
      setDraft(d as Draft);
      setEditSubject(d.subject ?? "");
      setEditBody(d.body ?? "");
      setEditing(false);
      toast.success("Draft created — approve it before sending");
      load();
    } catch (e: any) {
      toast.error(e.message || "Generate failed");
    } finally {
      setBusy(false);
    }
  };

  const act = async (path: string, label: string) => {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/emails/${draft.messageId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: label }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || `${label} failed`);
      toast.success(`${label} done`);
      if (path === "send") {
        setDraft((p) => (p ? { ...p, status: "sent" } : p));
      } else {
        setDraft((p) => (p ? { ...p, status: path === "approve" ? "approved" : "rejected" } : p));
      }
      load();
    } catch (e: any) {
      toast.error(e.message || `${label} failed`);
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    if (!draft) return;
    if (draft.status !== "approved") {
      toast.error("Approve this email first — client approval is required before sending");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/emails/${draft.messageId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Send failed");
      toast.success(d?.simulated ? "Email send simulated (no RESEND_API_KEY)" : "Email sent");
      setDraft((p) => (p ? { ...p, status: "sent" } : p));
      load();
    } catch (e: any) {
      toast.error(e.message || "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!draft || !editSubject.trim() || !editBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/emails/${draft.messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject.trim(), body: editBody.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      setDraft((p) => (p ? { ...p, subject: d.subject ?? editSubject, body: d.body ?? editBody, status: "draft" } : p));
      toast.success("Email edited — re-approve before sending");
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setBusy(false);
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
    <div className="container mx-auto px-6 py-8 max-w-3xl space-y-6">
      <Link href={`/leads/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to lead
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Draft Message — {lead?.name ?? ""}</CardTitle>
          <CardDescription>
            {lead?.email ? `To: ${lead.email} · ${lead.company ?? ""}` : "No email on this lead — edit the lead to add one."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={purpose === "intro" ? "default" : "outline"}
              onClick={() => setPurpose("intro")}
              title="Generate a first outreach email"
            >
              Intro email
            </Button>
            <Button
              size="sm"
              variant={purpose === "follow_up" ? "default" : "outline"}
              onClick={() => setPurpose("follow_up")}
              title="Generate a friendly follow-up email"
            >
              Follow-up email
            </Button>
            <span className="flex-1" />
            <Button onClick={generate} disabled={busy || !lead?.email} title="Ask AI to write this email">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {busy ? "Writing…" : "Ask AI to draft"}
            </Button>
          </div>

          {draft && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={draft.status === "sent" ? "default" : draft.status === "rejected" ? "destructive" : "secondary"}>
                  {draft.status}
                </Badge>
                {draft.approvalRequired && <Badge variant="outline">Needs approval</Badge>}
                {draft.mode && <span className="text-xs text-muted-foreground">{draft.mode}</span>}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Subject</p>
                {editing ? (
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} disabled={draft.status === "sent"} />
                ) : (
                  <p className="text-sm font-medium">{draft.subject}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Body</p>
                {editing ? (
                  <MiniEditor value={editBody} onChange={setEditBody} disabled={draft.status === "sent"} />
                ) : (
                  <div
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMiniMd(draft.body) }}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {draft.status !== "sent" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setEditSubject(draft.subject ?? ""); setEditBody(draft.body ?? ""); setEditing(true); }} disabled={busy} title="Edit subject and body">
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={generate} disabled={busy} title="Recreate a fresh AI draft">
                      <Sparkles className="mr-1 h-4 w-4" /> Recreate
                    </Button>
                  </>
                )}
                {editing && (
                  <Button size="sm" onClick={saveEdit} disabled={busy} title="Save edits (needs re-approve)">
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Save
                  </Button>
                )}
                {(draft.status === "pending_review" || draft.status === "draft") && (
                  <>
                    <Button size="sm" onClick={() => act("approve", "Approve")} disabled={busy} title="Approve this draft (required before send)">
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => act("reject", "Reject")} disabled={busy} title="Reject this draft">
                      <XCircle className="mr-1 h-4 w-4" /> Reject
                    </Button>
                  </>
                )}
                {draft.status === "approved" && (
                  <Button size="sm" onClick={sendNow} disabled={busy} title="Send this approved email now">
                    <Send className="mr-1 h-4 w-4" /> Send now
                  </Button>
                )}
                {draft.status !== "approved" && draft.status !== "sent" && (
                  <p className="w-full text-xs text-muted-foreground">Client approval required: Approve first, then Send becomes enabled.</p>
                )}
              </div>
            </div>
          )}

          {!draft && (
            <p className="text-sm text-muted-foreground">No draft yet. Pick Intro or Follow-up and click “Ask AI to draft”.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Attachments
          </CardTitle>
          <CardDescription>
            Attach documents (brochure, price list, floor plan PDF links) — the AI mentions them by name.
            {website ? ` Company website ${website} is added automatically with a “please review” line.` : " Set your company website in onboarding — it’s added automatically."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {website && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" /> Website: <a href={website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{website}</a>
            </p>
          )}
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
              <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-xs text-primary hover:underline max-w-[200px]">{a.url}</a>
              <Button size="sm" variant="ghost" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} title={`Remove ${a.name}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
            <Input value={attName} onChange={(e) => setAttName(e.target.value)} placeholder="Doc name (e.g. Price List 2026.pdf)" />
            <Input value={attUrl} onChange={(e) => setAttUrl(e.target.value)} placeholder="https://… (PDF link)" />
            <Button
              variant="outline"
              onClick={() => {
                const name = attName.trim();
                const url = attUrl.trim();
                if (!name || !url) return toast.error("Enter both name and URL");
                try {
                  new URL(url);
                } catch {
                  return toast.error("URL must start with http(s)://");
                }
                setAttachments((prev) => [...prev, { name, url }]);
                setAttName("");
                setAttUrl("");
              }}
              title="Add attachment"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Attach before drafting so AI mentions them. Tip: upload the PDF to Drive/S3 and paste its public link.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email history for this lead</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground">No emails yet.</p>}
          {history.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <span className="min-w-0 truncate">{m.subject ?? "(no subject)"}</span>
              <Badge variant="outline">{m.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeadMessagePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <MessageForm />
    </Suspense>
  );
}

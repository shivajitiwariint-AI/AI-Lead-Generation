"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailQuickActions, type EmailAttachment } from "@/components/email-quick-actions";
import { emailStatusLabel, emailStatusVariant } from "@/lib/email-status";
import { ArrowUpRight, Mail, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Email {
  id: string;
  leadId?: string | null;
  subject?: string | null;
  body?: string | null;
  toAddress?: string | null;
  status: string;
  generatedBy?: string;
  createdAt: string;
  sentAt?: string | null;
  meta?: Record<string, any>;
}

interface Lead {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
}

const FILTERS = [
  "all",
  "pending_review",
  "draft",
  "approved",
  "sent",
  "simulated",
  "bounced",
  "rejected",
] as const;

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [leadFilter, setLeadFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [genLead, setGenLead] = useState("");
  const [genPurpose, setGenPurpose] = useState<"intro" | "follow_up">("intro");
  const [generating, setGenerating] = useState(false);

  const loadEmails = async (selectId?: string) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (leadFilter !== "all") params.set("leadId", leadFilter);
    const res = await fetch(`/api/v1/emails?${params.toString()}`);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const next = Array.isArray(json?.data) ? (json.data as Email[]) : [];
      setEmails(next);
      setSelectedId((current) => {
        if (selectId && next.some((email) => email.id === selectId)) return selectId;
        if (current && next.some((email) => email.id === current)) return current;
        return next[0]?.id ?? null;
      });
    }
  };

  // Leads are used for the AI picker and the lead filter.
  useEffect(() => {
    fetch("/api/v1/leads?limit=100")
      .then((r) => r.json())
      .then((l) => setLeads(Array.isArray(l?.data) ? l.data : []))
      .catch(() => setLeads([]));
  }, []);

  useEffect(() => {
    loadEmails().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, leadFilter]);

  const selected = emails.find((email) => email.id === selectedId) ?? null;
  const selectedLead = selected?.leadId
    ? leads.find((lead) => lead.id === selected.leadId)
    : undefined;

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
      if (!res.ok) throw new Error(data?.error?.message || "Could not create the draft");
      toast.success("Draft ready — review it below, then approve and send.");
      setGenLead("");
      await loadEmails(data?.messageId);
    } catch (e: any) {
      toast.error(e.message || "Could not create the draft");
    } finally {
      setGenerating(false);
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
        <h1 className="text-3xl font-semibold tracking-tight">Emails</h1>
        <p className="text-muted-foreground">
          Write, review and send outreach emails. Nothing is sent until you approve it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" /> Write a new email
          </CardTitle>
          <CardDescription>
            Pick a lead and let AI write the first draft. You can edit it before approving.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-2">
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
            <Label>Type</Label>
            <Select value={genPurpose} onValueChange={(v: any) => setGenPurpose(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intro">Intro email</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={!genLead || generating}>
            <Plus className="mr-2 h-4 w-4" />
            {generating ? "Writing…" : "Write with AI"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={filter === status ? "default" : "outline"}
              onClick={() => setFilter(status)}
            >
              {status === "all" ? "All" : emailStatusLabel(status)}
            </Button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <Select value={leadFilter} onValueChange={setLeadFilter}>
            <SelectTrigger aria-label="Filter by lead">
              <SelectValue placeholder="All leads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All leads</SelectItem>
              {leads.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.name} {lead.company ? `· ${lead.company}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All emails ({emails.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {emails.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No emails match this filter yet.
              </p>
            )}
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => setSelectedId(email.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
                  selectedId === email.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {email.subject || "(no subject)"}
                  </span>
                  <Badge variant={emailStatusVariant(email.status)}>
                    {emailStatusLabel(email.status)}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {email.toAddress || "No recipient"} · {formatDate(email.createdAt)}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review and send</CardTitle>
            <CardDescription>
              {selected
                ? "Read the email, make any changes, then approve it."
                : "Select an email from the list to review it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <div className="py-10 text-center">
                <Mail className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Nothing selected</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose an email on the left, or write a new one above.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                    <p className="min-w-0 truncate text-sm font-semibold">
                      {selected.subject || "(no subject)"}
                    </p>
                    <Badge variant={emailStatusVariant(selected.status)}>
                      {emailStatusLabel(selected.status)}
                    </Badge>
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="text-xs text-muted-foreground">
                      To: {selected.toAddress || "No recipient"}
                      {selected.sentAt
                        ? ` · Sent ${formatDate(selected.sentAt)}`
                        : ` · Created ${formatDate(selected.createdAt)}`}
                    </p>
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {selected.body || "(empty message)"}
                    </pre>
                  </div>
                </div>

                {selected.leadId && (
                  <Button variant="link" size="sm" className="h-auto p-0" asChild>
                    <Link href={`/leads/${selected.leadId}#email-outreach`}>
                      Open the lead page <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}

                <EmailQuickActions
                  key={selected.id}
                  messageId={selected.id}
                  status={selected.status}
                  subject={selected.subject ?? ""}
                  body={selected.body ?? ""}
                  toAddress={selected.toAddress ?? undefined}
                  simulated={Boolean(selected.meta?.simulated)}
                  bounceReason={
                    selected.meta?.bounceReason
                      ? String(selected.meta.bounceReason)
                      : undefined
                  }
                  attachments={
                    Array.isArray(selected.meta?.attachments)
                      ? (selected.meta.attachments as EmailAttachment[])
                      : []
                  }
                  onChanged={() => {
                    void loadEmails(selected.id);
                  }}
                />

                {selected.meta?.mock && (
                  <p className="text-xs text-muted-foreground">
                    This draft used the basic writer because no AI model is connected. You can
                    still edit it before sending.
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmailQuickActions, type EmailAttachment } from "@/components/email-quick-actions";
import { emailStatusLabel, emailStatusVariant } from "@/lib/email-status";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";

export type LeadEmail = {
  id: string;
  subject: string;
  body: string;
  status: string;
  toAddress: string | null;
  createdAt: string;
  sentAt: string | null;
  meta: Record<string, any>;
};

function normalizeMessage(raw: any): LeadEmail {
  const meta = { ...(raw?.meta ?? {}) };
  if (Array.isArray(meta.attachments)) {
    meta.attachments = meta.attachments.map((attachment: any) => {
      const { content: _content, ...rest } = attachment ?? {};
      return rest as EmailAttachment;
    });
  }
  return {
    id: raw.id,
    subject: raw.subject ?? "",
    body: raw.body ?? "",
    status: raw.status,
    toAddress: raw.toAddress ?? null,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    sentAt: raw.sentAt ?? null,
    meta,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function LeadEmailOutreach({
  leadId,
  hasEmail,
  initialEmails,
}: {
  leadId: string;
  hasEmail: boolean;
  initialEmails: LeadEmail[];
}) {
  const router = useRouter();
  const [emails, setEmails] = useState<LeadEmail[]>(initialEmails);
  const [selectedId, setSelectedId] = useState<string | null>(initialEmails[0]?.id ?? null);
  const [purpose, setPurpose] = useState<"intro" | "follow_up">("intro");
  const [generating, setGenerating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setEmails(initialEmails);
    setSelectedId((current) =>
      current && initialEmails.some((email) => email.id === current)
        ? current
        : initialEmails[0]?.id ?? null
    );
  }, [initialEmails]);

  const selected = emails.find((email) => email.id === selectedId) ?? emails[0] ?? null;

  const refreshEmails = async (selectId?: string) => {
    try {
      const res = await fetch(`/api/v1/emails?leadId=${encodeURIComponent(leadId)}`);
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      const next: LeadEmail[] = Array.isArray(json?.data)
        ? json.data.map(normalizeMessage)
        : [];
      setEmails(next);
      setSelectedId((current) => {
        if (selectId && next.some((email) => email.id === selectId)) return selectId;
        if (current && next.some((email) => email.id === current)) return current;
        return next[0]?.id ?? null;
      });
    } catch {
      // Keep the current list if refreshing fails.
    }
  };

  const generate = async () => {
    if (!hasEmail) {
      toast.error("Add an email address to this lead first.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, purpose }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not create the draft");
      await refreshEmails(data?.messageId);
      toast.success("Draft ready! Review it below, then approve and send.");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not create the draft");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-full bg-primary/10 p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Write your email</p>
            <p className="text-xs text-muted-foreground">
              Pick the type, then let AI write a first draft for this lead.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={purpose === "intro" ? "default" : "outline"}
            onClick={() => setPurpose("intro")}
            disabled={generating}
            title="Write a first email to this lead"
          >
            Intro email
          </Button>
          <Button
            size="sm"
            variant={purpose === "follow_up" ? "default" : "outline"}
            onClick={() => setPurpose("follow_up")}
            disabled={generating}
            title="Write a friendly follow-up email"
          >
            Follow-up
          </Button>
          <span className="flex-1" />
          <Button
            onClick={generate}
            disabled={generating || !hasEmail}
            title={hasEmail ? "Write this email with AI" : "Add an email address to this lead first"}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {generating ? "Writing…" : "Write with AI"}
          </Button>
        </div>

        {!hasEmail && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Add an email address to this lead to start writing.
          </p>
        )}
      </div>

      {!selected ? (
        <div className="rounded-lg border border-border p-5 text-center">
          <Mail className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No email yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose Intro or Follow-up above, then click “Write with AI”.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div id="lead-email-preview" className="scroll-mt-24 overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border bg-muted/30 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">
                  {selected.subject || "(no subject)"}
                </p>
                <Badge variant={emailStatusVariant(selected.status)}>
                  {emailStatusLabel(selected.status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                To: {selected.toAddress || "No recipient"}
                {selected.sentAt
                  ? ` · Sent ${formatDate(selected.sentAt)}`
                  : ` · Created ${formatDate(selected.createdAt)}`}
              </p>
            </div>
            <div className="space-y-2 p-3">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{selected.body}</pre>
            </div>
          </div>

          <EmailQuickActions
            key={selected.id}
            messageId={selected.id}
            status={selected.status}
            subject={selected.subject}
            body={selected.body}
            toAddress={selected.toAddress ?? undefined}
            simulated={Boolean(selected.meta?.simulated)}
            bounceReason={
              selected.meta?.bounceReason ? String(selected.meta.bounceReason) : undefined
            }
            attachments={
              Array.isArray(selected.meta?.attachments)
                ? (selected.meta.attachments as EmailAttachment[])
                : []
            }
            onChanged={() => {
              void refreshEmails();
            }}
          />

          {selected.meta?.mock && (
            <p className="text-xs text-muted-foreground">
              This draft used the basic writer because no AI model is connected. You can still edit it
              before sending.
            </p>
          )}

          {emails.length > 1 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setHistoryOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/40"
                aria-expanded={historyOpen}
              >
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email history
                  <Badge variant="secondary">{emails.length}</Badge>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    historyOpen && "rotate-180"
                  )}
                />
              </button>
              {historyOpen && (
                <div className="max-h-80 divide-y divide-border overflow-y-auto border-t border-border">
                  {emails.map((email) => (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(email.id);
                        setHistoryOpen(false);
                        requestAnimationFrame(() => {
                          document
                            .getElementById("lead-email-preview")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                        email.id === selected.id && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {email.subject || "(no subject)"}
                        </span>
                        <Badge variant={emailStatusVariant(email.status)}>
                          {emailStatusLabel(email.status)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {email.toAddress || "No recipient"} · {formatDate(email.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

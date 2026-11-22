"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  MailCheck,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export type EmailAttachment = { name: string; url: string };

type Tone = "warning" | "success" | "danger" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  warning:
    "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  success:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/40 text-foreground",
};

function prettyStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusMessage(
  status: string,
  simulated: boolean,
  bounceReason?: string,
  toAddress?: string
): { icon: typeof Clock; tone: Tone; title: string; text: string } {
  if (status === "bounced") {
    return {
      icon: AlertTriangle,
      tone: "danger",
      title: "Delivery failed",
      text: bounceReason
        ? `The email could not be delivered (${bounceReason.replace(/_/g, " ")}). Check the address, then write a new draft.`
        : "The email could not be delivered. Check the address, then write a new draft.",
    };
  }
  if (status === "simulated" || simulated) {
    return {
      icon: AlertTriangle,
      tone: "warning",
      title: "Not delivered yet",
      text: "Email delivery is not set up for this workspace. Ask your admin to add SMTP in Settings, then click Retry sending.",
    };
  }
  if (status === "sent") {
    return {
      icon: MailCheck,
      tone: "success",
      title: "Email sent",
      text: "This email has been delivered to the lead.",
    };
  }
  if (status === "approved") {
    return {
      icon: CheckCircle2,
      tone: "success",
      title: "Approved — ready to send",
      text: toAddress
        ? `Everything looks good. Click Send email to deliver it to ${toAddress}.`
        : "Everything looks good. Click Send email whenever you are ready.",
    };
  }
  if (status === "rejected") {
    return {
      icon: XCircle,
      tone: "muted",
      title: "Draft rejected",
      text: "This draft will not be sent. Write a new draft above, or edit this one to bring it back.",
    };
  }
  if (status === "pending_review" || status === "draft") {
    return {
      icon: Clock,
      tone: "warning",
      title: "Needs your approval",
      text: "Read the email, make any changes, then approve it. Nothing is sent until you approve.",
    };
  }
  return {
    icon: Info,
    tone: "muted",
    title: prettyStatus(status),
    text: "",
  };
}

export function EmailQuickActions({
  messageId,
  status: initialStatus,
  subject: initialSubject,
  body: initialBody,
  toAddress,
  simulated = false,
  bounceReason,
  attachments: initialAttachments = [],
}: {
  messageId: string;
  status: string;
  subject: string;
  body: string;
  toAddress?: string;
  simulated?: boolean;
  bounceReason?: string;
  attachments?: EmailAttachment[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "attach">("view");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [attachments, setAttachments] = useState<EmailAttachment[]>(initialAttachments);
  const [attName, setAttName] = useState("");
  const [attUrl, setAttUrl] = useState("");

  const canReview = status === "pending_review" || status === "draft";
  const canEdit = status !== "sent" && status !== "bounced";
  const canAttach = status !== "sent" && status !== "bounced";
  const info = statusMessage(status, simulated, bounceReason, toAddress);
  const StatusIcon = info.icon;

  const approve = async () => {
    setBusy("approve");
    try {
      const res = await fetch(`/api/v1/emails/${messageId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not approve the email");
      setStatus("approved");
      toast.success("Approved! You can send it now.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not approve the email");
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!confirm("Reject this draft? It will not be sent.")) return;
    setBusy("reject");
    try {
      const res = await fetch(`/api/v1/emails/${messageId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected from lead page" }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not reject the draft");
      setStatus("rejected");
      toast.success("Draft rejected");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not reject the draft");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("send");
    try {
      const res = await fetch(`/api/v1/emails/${messageId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not send the email");
      if (d?.sent) {
        setStatus("sent");
        toast.success("Email sent!");
      } else if (d?.simulated) {
        setStatus("simulated");
        toast.info("Nothing was delivered — no email provider is configured yet.");
      } else {
        setStatus("bounced");
        toast.error(d?.reason ? `Not delivered: ${d.reason}` : "Email not delivered");
      }
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not send the email");
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async () => {
    if (!subject.trim()) {
      toast.error("Please add a subject");
      return;
    }
    if (!body.trim()) {
      toast.error("Please add a message");
      return;
    }
    setBusy("edit");
    try {
      const res = await fetch(`/api/v1/emails/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not save changes");
      if (d?.status) setStatus(d.status);
      toast.success("Changes saved. Review and approve when ready.");
      setMode("view");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not save changes");
    } finally {
      setBusy(null);
    }
  };

  const addAttachment = () => {
    const name = attName.trim();
    const url = attUrl.trim();
    if (!name || !url) return toast.error("Add a document name and a link");
    try {
      new URL(url);
    } catch {
      return toast.error("The link must start with http:// or https://");
    }
    if (attachments.some((a) => a.name === name && a.url === url)) {
      return toast.error("That document is already attached");
    }
    setAttachments((prev) => [...prev, { name, url }]);
    setAttName("");
    setAttUrl("");
  };

  const saveAttachments = async () => {
    setBusy("attach");
    try {
      // Attachments are delivered as links in the message body, so append any
      // document names that are not already mentioned.
      const missing = attachments.filter((a) => !body.includes(a.name));
      const nextBody =
        missing.length > 0
          ? `${body}\n\nAttachments:\n${missing.map((a) => `${a.name} — ${a.url}`).join("\n")}`
          : body;

      const res = await fetch(`/api/v1/emails/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachments, body: nextBody }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not save the attachment");
      if (d?.status) setStatus(d.status);
      setBody(nextBody);
      toast.success("Document added to the email");
      setMode("view");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Could not save the attachment");
    } finally {
      setBusy(null);
    }
  };

  const anyBusy = busy !== null;

  return (
    <div className="space-y-3">
      <div className={`flex gap-2.5 rounded-lg border p-3 ${TONE_CLASSES[info.tone]}`}>
        <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{info.title}</p>
          {info.text && <p className="mt-0.5 text-xs opacity-80">{info.text}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canReview && (
          <Button size="sm" onClick={approve} disabled={anyBusy} title="Approve this email">
            {busy === "approve" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" />
            )}
            Approve email
          </Button>
        )}
        {status === "approved" && (
          <Button size="sm" onClick={send} disabled={anyBusy} title="Send this email now">
            {busy === "send" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Send email
          </Button>
        )}
        {status === "simulated" && (
          <Button size="sm" onClick={send} disabled={anyBusy} title="Try sending again">
            {busy === "send" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Retry sending
          </Button>
        )}
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMode(mode === "edit" ? "view" : "edit")}
            disabled={anyBusy}
            title="Edit the subject and message"
          >
            <Pencil className="mr-1 h-4 w-4" /> Edit message
          </Button>
        )}
        {canAttach && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMode(mode === "attach" ? "view" : "attach")}
            disabled={anyBusy}
            title="Attach a document link"
          >
            <Paperclip className="mr-1 h-4 w-4" /> Attach document
          </Button>
        )}
        {canReview && (
          <Button
            size="sm"
            variant="ghost"
            onClick={reject}
            disabled={anyBusy}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Reject this draft"
          >
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
        )}
      </div>

      {attachments.length > 0 && mode !== "attach" && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <a
              key={`${a.name}-${a.url}`}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
              title={a.url}
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">{a.name}</span>
            </a>
          ))}
        </div>
      )}

      {mode === "edit" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Edit email</p>
            <p className="text-xs text-muted-foreground">
              Make it personal. Saving keeps the email ready for review.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`subject-${messageId}`}>Subject</Label>
            <Input
              id={`subject-${messageId}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`body-${messageId}`}>Message</Label>
            <Textarea
              id={`body-${messageId}`}
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveEdit} disabled={anyBusy}>
              {busy === "edit" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSubject(initialSubject);
                setBody(initialBody);
                setMode("view");
              }}
              disabled={anyBusy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "attach" && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Attach a document</p>
            <p className="text-xs text-muted-foreground">
              Upload your file to Google Drive, Dropbox or your website, then paste the share link here.
            </p>
          </div>
          {attachments.length > 0 ? (
            <ul className="space-y-2">
              {attachments.map((a, i) => (
                <li key={`${a.name}-${i}`} className="flex items-center gap-2 text-sm">
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-[180px] truncate text-xs text-primary hover:underline"
                  >
                    {a.url}
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    title={`Remove ${a.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No documents attached yet.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
            <Input
              value={attName}
              onChange={(e) => setAttName(e.target.value)}
              placeholder="Document name (e.g. Price List.pdf)"
              aria-label="Document name"
            />
            <Input
              value={attUrl}
              onChange={(e) => setAttUrl(e.target.value)}
              placeholder="Paste public link (https://…)"
              aria-label="Document link"
            />
            <Button variant="outline" onClick={addAttachment} disabled={anyBusy} title="Add document">
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveAttachments} disabled={anyBusy}>
              {busy === "attach" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save document
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("view")} disabled={anyBusy}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The link is added to the email body so the recipient can open it.
          </p>
        </div>
      )}
    </div>
  );
}

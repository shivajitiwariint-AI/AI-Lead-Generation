"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * Inline AI draft controls for the lead detail page. Generation happens here so
 * users never have to leave the lead to write an outreach email.
 */
export function LeadDraftComposer({
  leadId,
  hasEmail,
}: {
  leadId: string;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<"intro" | "follow_up">("intro");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!hasEmail) {
      toast.error("Add an email address to this lead first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, purpose }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || "Could not create the draft");
      }
      toast.success("Draft ready! Review it below, then approve and send.");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not create the draft");
    } finally {
      setBusy(false);
    }
  };

  return (
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
          disabled={busy}
          title="Write a first email to this lead"
        >
          Intro email
        </Button>
        <Button
          size="sm"
          variant={purpose === "follow_up" ? "default" : "outline"}
          onClick={() => setPurpose("follow_up")}
          disabled={busy}
          title="Write a friendly follow-up email"
        >
          Follow-up
        </Button>
        <span className="flex-1" />
        <Button
          onClick={generate}
          disabled={busy || !hasEmail}
          title={hasEmail ? "Write this email with AI" : "Add an email address to this lead first"}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {busy ? "Writing…" : "Write with AI"}
        </Button>
      </div>

      {!hasEmail && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Add an email address to this lead to start writing.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PhoneCall, StickyNote } from "lucide-react";
import { toast } from "sonner";

export function LeadNoteComposer({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"note" | "call_logged">("note");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = note.trim();
    if (!value) {
      toast.error("Write something first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityType: kind, payload: { note: value } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not save this");
      setNote("");
      toast.success(kind === "call_logged" ? "Call logged" : "Note added to the timeline");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not save this");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Add to the timeline</p>
        <div className="flex gap-1 rounded-md bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setKind("note")}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              kind === "note" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <StickyNote className="h-3 w-3" /> Note
          </button>
          <button
            type="button"
            onClick={() => setKind("call_logged")}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              kind === "call_logged" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PhoneCall className="h-3 w-3" /> Call
          </button>
        </div>
      </div>
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          kind === "call_logged"
            ? "Who did you speak to, and what was discussed?"
            : "What happened? e.g. Asked for pricing and a walkthrough next week."
        }
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={busy || !note.trim()}>
          {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {kind === "call_logged" ? "Log call" : "Add note"}
        </Button>
      </div>
    </div>
  );
}

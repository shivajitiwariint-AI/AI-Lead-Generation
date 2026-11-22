"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function RunQualificationButton({
  leadId,
  hasQualification,
}: {
  leadId: string;
  hasQualification: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/qualify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not run qualification");
      const total = data?.totalScore ?? data?.fitScore;
      toast.success(
        typeof total === "number" ? `Qualification updated — ${total}/100` : "Qualification updated"
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Could not run qualification");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={hasQualification ? "outline" : "default"}
      onClick={run}
      disabled={busy}
      title="Ask AI to score this lead against your offer"
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
      )}
      {busy ? "Scoring…" : hasQualification ? "Re-run" : "Run AI check"}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUS_OPTIONS, leadStatusLabel } from "@/lib/lead-status";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LeadStatusSelect({
  leadId,
  status: initialStatus,
}: {
  leadId: string;
  status: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  const change = async (next: string) => {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not update status");
      toast.success(`Status updated to ${leadStatusLabel(next)}`);
      router.refresh();
    } catch (err: any) {
      setStatus(previous);
      toast.error(err?.message || "Could not update status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={status} onValueChange={change} disabled={busy}>
        <SelectTrigger
          className="h-8 w-auto min-w-[9.5rem] rounded-full bg-card px-3 text-xs font-semibold"
          title="Change this lead's status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

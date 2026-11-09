"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DeleteLeadButton({ leadId, name }: { leadId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const del = async () => {
    if (!confirm(`Delete lead “${name}”? This removes the lead and its emails/activities. This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}`, { method: "DELETE" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Delete failed");
      toast.success("Lead deleted");
      router.push("/leads");
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      className="w-full"
      variant="destructive"
      onClick={del}
      disabled={busy}
      title="Delete this lead (wrong or fake create)"
    >
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
      {busy ? "Deleting…" : "Delete Lead"}
    </Button>
  );
}

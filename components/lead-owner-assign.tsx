"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Member = { id: string; name: string | null; email: string };

export function LeadOwnerAssign({
  leadId,
  ownerId,
  ownerName,
  ownerEmail,
  members,
  compact,
  onAssigned,
}: {
  leadId: string;
  ownerId: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  members: Member[];
  compact?: boolean;
  onAssigned?: (ownerId: string | null, ownerName: string | null, ownerEmail: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<{ id: string | null; name: string | null; email: string | null }>({
    id: ownerId ?? null,
    name: ownerName ?? null,
    email: ownerEmail ?? null,
  });

  const assign = async (value: string) => {
    const nextId = value === "__unassigned__" ? null : value;
    if (nextId === current.id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: nextId }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Assign failed");
      const member = members.find((m) => m.id === nextId) ?? null;
      const next = {
        id: nextId,
        name: (d?.ownerName ?? member?.name ?? member?.email ?? null) as string | null,
        email: (d?.ownerEmail ?? member?.email ?? null) as string | null,
      };
      setCurrent(next);
      onAssigned?.(next.id, next.name, next.email);
      toast.success(nextId ? `Assigned to ${next.name}` : "Owner removed");
    } catch (e: any) {
      toast.error(e.message || "Assign failed");
    } finally {
      setBusy(false);
    }
  };

  const extra = current.id && !members.some((m) => m.id === current.id)
    ? [{ id: current.id, name: current.name, email: current.email ?? "" }]
    : [];
  const options = [...extra, ...members];

  if (!members.length && !extra.length) {
    return current.name ? (
      <span className="block max-w-[10rem] truncate text-sm" title={current.email ?? current.name ?? ""}>
        {current.name}
      </span>
    ) : (
      <span className="text-sm text-muted-foreground">Unassigned</span>
    );
  }

  return (
    <Select
      value={current.id ?? "__unassigned__"}
      onValueChange={assign}
      disabled={busy}
    >
      <SelectTrigger
        className={cn("h-8 w-full text-xs", compact && "max-w-[10rem]")}
        title={busy ? "Assigning…" : `Assign owner — current: ${current.name ?? "Unassigned"}${current.email ? ` (${current.email})` : ""}. Pick a teammate to own this lead.`}
      >
        <SelectValue
          placeholder="Unassigned"
          className="text-xs"
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__unassigned__">Unassigned</SelectItem>
        {options.map((m) => (
          <SelectItem key={m.id} value={m.id} title={m.email}>
            {m.name ?? m.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Hand, Bot } from "lucide-react";
import { toast } from "sonner";

export function LeadTakeoverToggle({
  leadId,
  initialMode,
}: {
  leadId: string;
  initialMode: string;
}) {
  const [mode, setMode] = useState(initialMode || "ai");
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    const next = mode === "manual" ? "ai" : "manual";
    try {
      const res = await fetch(`/api/v1/leads/${leadId}/control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlMode: next }),
      });
      if (!res.ok) throw new Error("Failed");
      setMode(next);
      toast.success(next === "manual" ? "Manual takeover activated" : "AI control resumed");
    } catch {
      toast.error("Could not update control mode");
    } finally {
      setLoading(false);
    }
  };

  const isManual = mode === "manual";
  return (
    <Button
      className="w-full"
      variant={isManual ? "default" : "outline"}
      onClick={toggle}
      disabled={loading}
    >
      {isManual ? (
        <>
          <Bot className="h-4 w-4 mr-2" /> Resume AI control
        </>
      ) : (
        <>
          <Hand className="h-4 w-4 mr-2" /> Manual takeover
        </>
      )}
    </Button>
  );
}

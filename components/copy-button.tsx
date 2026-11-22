"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — please copy manually");
    }
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={copy}
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      title={`${label}: ${value}`}
      aria-label={`${label}: ${value}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

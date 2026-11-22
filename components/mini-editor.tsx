"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Link2, List, Underline } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function renderMiniMd(text: string) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/__(.+?)__/g, "<u>$1</u>")
    .replace(/\n/g, "<br/>");
}

export function MiniEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const wrap = (before: string, after: string, fallback = "text") => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertLine = (prefix: string) => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`);
    requestAnimationFrame(() => ta.focus());
  };

  const insertLink = () => {
    const ta = ref.current;
    if (!ta || disabled) return;
    const url = window.prompt("Paste the link URL (https://…)");
    if (!url) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || "link text";
    onChange(`${value.slice(0, start)}${selected} (${url})${value.slice(end)}`);
    requestAnimationFrame(() => ta.focus());
  };

  const tools = [
    { icon: Bold, label: "Bold", action: () => wrap("**", "**") },
    { icon: Italic, label: "Italic", action: () => wrap("*", "*") },
    { icon: Underline, label: "Underline", action: () => wrap("__", "__") },
    { icon: List, label: "Bullet", action: () => insertLine("\n• ") },
    { icon: Link2, label: "Insert link", action: insertLink },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-muted/20 p-1.5">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            onClick={tool.action}
            disabled={disabled}
            title={tool.label}
            aria-label={tool.label}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted disabled:opacity-50"
          >
            <tool.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          title="Toggle preview"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div
          className="min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMiniMd(value) }}
        />
      ) : (
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          disabled={disabled}
        />
      )}
      <p className="text-[11px] text-muted-foreground">
        Styles: **bold**, *italic*, __underline__. Preview shows how the email will look.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ id: string; title: string }>;
}

const SUGGESTIONS = [
  "What does the platform do?",
  "How does lead scoring work?",
  "Real Estate help?",
  "Pricing and plans?",
];

export function PublicChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, busy]);

  const send = async (text: string) => {
    const content = text.trim().slice(0, 500);
    if (!content || busy) return;
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));
    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/v1/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data?.error?.message ?? "Something went wrong. Please try again." },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't reach the assistant. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[480px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020]/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">AI Assistant</p>
              <p className="text-[11px] text-white/50">Public info only · Ask about services &amp; pricing</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/60 hover:text-white"
              aria-label="Close chat"
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="space-y-3 py-2">
                <p className="text-sm text-white/70">
                  Hi! I can explain what we offer, how lead scoring works, and how to get started. What would you like to know?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                      title={`Ask: ${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-gradient-to-r from-indigo-500 to-cyan-400 text-white"
                      : "border border-white/10 bg-white/5 text-white/90"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.sources && m.sources.length > 0 && (
                    <p className="mt-1 text-[10px] text-white/40">Based on: {m.sources.map((s) => s.title).join(", ")}</p>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about services, features, pricing…"
              className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-cyan-400/40"
              title="Type your question"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white disabled:opacity-50"
              aria-label="Send message"
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 text-white shadow-xl shadow-indigo-500/40 transition-transform hover:scale-105"
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        title={open ? "Close AI chat" : "Ask AI about our services"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}

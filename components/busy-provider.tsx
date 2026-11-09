"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

export function BusyProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = React.useState(0);
  const pendingRef = React.useRef(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      pendingRef.current += 1;
      queueMicrotask(() => setPending(pendingRef.current));
      try {
        return await original(...args);
      } finally {
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        queueMicrotask(() => setPending(pendingRef.current));
      }
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  // Keep pathname referenced so route changes are observed (fetches drive the bar).
  React.useEffect(() => {
    void pathname;
  }, [pathname]);

  const busy = pending > 0;

  return (
    <>
      <div
        className={`pointer-events-none fixed left-0 top-0 z-[100] h-0.5 w-full transition-opacity duration-200 ${
          busy ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-purple-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]"
          style={{
            width: busy ? "100%" : "0%",
            transition: busy ? "width 8s cubic-bezier(0.1,0.9,0.2,1)" : "width 0.2s ease",
          }}
        />
      </div>
      {busy && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-cyan-400" />
          Working…
        </div>
      )}
      {children}
    </>
  );
}

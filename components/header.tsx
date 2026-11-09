"use client";

import * as React from "react";
import { Search, Bell, UserCircle, Menu } from "lucide-react";
import { Link } from "@/components/link";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  className?: string;
  userName?: string;
  onMenuClick?: () => void;
}

export function Header({ className, userName = "Account", onMenuClick }: HeaderProps) {
  const [notifCount, setNotifCount] = React.useState(0);
  const [latest, setLatest] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/agent/run?limit=3");
        if (!res.ok) return;
        const d = await res.json();
        const runs = (d.data ?? []) as Array<{
          status: string;
          summary?: string | null;
          finishedAt?: string | null;
          startedAt: string;
          trigger: string;
        }>;
        if (cancelled) return;
        const last = runs[0];
        if (last?.finishedAt) {
          const minutes = (Date.now() - new Date(last.finishedAt).getTime()) / 60000;
          setNotifCount(minutes < 120 ? 1 : 0);
          setLatest(
            last.summary?.slice(0, 120) ??
              `${last.trigger} run ${last.status}`
          );
        } else if (last) {
          setNotifCount(1);
          setLatest(`${last.trigger} run ${last.status}`);
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed left-0 lg:left-64 right-0 top-0 z-30 h-16 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/60 flex items-center justify-between px-4 lg:px-6 shrink-0",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden -ml-1 flex h-10 w-10 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]/10 transition-colors"
          aria-label="Open main menu"
          title="Open main menu"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open main menu</span>
        </button>
        <div className="hidden md:flex items-center gap-1 md:gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              className="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none appearance-none [&::-webkit-search-cancel-button]:appearance-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:w-80"
              placeholder="Search leads, campaigns, contacts..."
              title="Search leads, campaigns, contacts..."
            />
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <button
          className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
          aria-label="Notifications"
          title="Notifications: latest AI activity"
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
          {notifCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {notifCount}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-12 w-80 rounded-lg border border-border bg-popover p-3 shadow-lg">
            <p className="text-xs font-semibold text-muted-foreground">AI activity</p>
            {latest ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm">{latest}</p>
                <a href="/activity" className="text-xs text-primary hover:underline">
                  Open Live Activity
                </a>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No AI runs yet. Run Ask AI.</p>
            )}
          </div>
        )}
        <Link
          href="/profile"
          title="Open your profile"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <UserCircle className="h-5 w-5" />
          <span className="max-w-[10ch] truncate">{userName}</span>
        </Link>
      </div>
    </header>
  );
}

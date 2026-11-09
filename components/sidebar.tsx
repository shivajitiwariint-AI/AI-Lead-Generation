"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Link } from "@/components/link";
import { cn } from "@/lib/utils";
import {
  Sun,
  Moon,
  LayoutDashboard,
  Users,
  ChartPie,
  Settings,
  CalendarCheck,
  Shield,
  LayoutGrid,
  HelpCircle,
  LogOut,
  Cpu,
  BarChart3,
  FileText,
  Target,
  Clock,
  Building2,
  Search,
  Mail,
  Activity as ActivityIcon,
} from "lucide-react";

const navItems = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", href: "/leads", icon: LayoutGrid },
  { title: "Pipeline", href: "/pipeline", icon: ChartPie },
  { title: "Conversations", href: "/conversations", icon: HelpCircle },
  { title: "Meetings", href: "/meetings", icon: CalendarCheck },
  { title: "Chatbots", href: "/chatbots", icon: LayoutGrid },
  { title: "Knowledge Base", href: "/knowledge-base", icon: FileText },
  { title: "Follow-ups", href: "/follow-ups", icon: Clock },
  { title: "Integrations", href: "/integrations", icon: Shield },
  { title: "Team", href: "/team", icon: Users },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Scoring Profiles", href: "/scoring-profiles", icon: Target },
  { title: "Settings", href: "/settings", icon: Settings },

  // AI-first autonomous sales system (upgraded requirements)
  { title: "Company", href: "/company", icon: Building2 },
  { title: "Research", href: "/research", icon: Search },
  { title: "Emails", href: "/emails", icon: Mail },
  { title: "Activity", href: "/activity", icon: ActivityIcon },
];

const superAdminNavItems = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Companies", href: "/admin/companies", icon: Building2 },
  { title: "AI Providers", href: "/ai-providers", icon: Cpu },
  { title: "AI Models", href: "/ai-models", icon: Cpu },
  { title: "AI Assignments", href: "/ai-assignments", icon: Target },
  { title: "AI Usage", href: "/ai-usage", icon: BarChart3 },
  { title: "Public Docs", href: "/admin/public-docs", icon: FileText },
  { title: "Roles", href: "/admin/roles", icon: Shield },
  { title: "Audit Logs", href: "/audit-logs", icon: Shield },
  { title: "Settings", href: "/settings", icon: Settings },
];

export interface SidebarProps {
  className?: string;
  open?: boolean;
  onClose?: () => void;
  isSuperAdmin?: boolean;
  enabledModules?: string[] | null;
}

export function Sidebar({ className, open = false, onClose, isSuperAdmin = false, enabledModules = null }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && theme === "dark";

  // Module access control: null/undefined = admin hasn't configured (all allowed); [] = explicitly disabled all
  const ALWAYS_VISIBLE = new Set(["/dashboard", "/profile"]);
  const moduleAllowed = (href: string) => {
    if (ALWAYS_VISIBLE.has(href)) return true;
    if (enabledModules == null || !Array.isArray(enabledModules)) return true;
    if (enabledModules.length === 0) return false;
    const key = href.replace(/^\//, "").split("/")[0];
    return enabledModules.includes(key) || enabledModules.includes("*");
  };

  const baseNav = isSuperAdmin ? superAdminNavItems : navItems;
  const visibleNav = baseNav.filter((item) => (isSuperAdmin ? true : moduleAllowed(item.href)));

  // Super admin section (only for non-super-admin? no, super admin already has Companies in base)
  const adminNav: { title: string; href: string; icon: any }[] = [];

  return (
    <>
      {/* Mobile backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] flex flex-col transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          className
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 shrink-0 border-b border-[hsl(var(--border))]">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </span>
            <span className="font-semibold text-lg tracking-tight">AI Lead Gen</span>
          </Link>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-1.5 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]/10 transition-colors"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {mounted ? (
              isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <span className="block h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.title}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/15 text-primary shadow-[0_0_12px_-2px_rgba(99,102,241,0.4)]"
                    : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]/10 hover:text-[hsl(var(--foreground))] hover:no-underline"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.title}
              </Link>
            );
          })}

          {adminNav.length > 0 && (
            <>
              <div className="my-2 border-t border-[hsl(var(--border))]" />
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Super Admin
              </p>
              {adminNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-primary/15 text-primary shadow-[0_0_12px_-2px_rgba(99,102,241,0.4)]"
                        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]/10 hover:text-[hsl(var(--foreground))] hover:no-underline"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {item.title}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[hsl(var(--border))]">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]/10 hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

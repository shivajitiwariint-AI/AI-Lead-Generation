"use client";

import * as React from "react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { AiBackground } from "@/components/ai-background";

export function AppShell({ children, userName, isSuperAdmin = false, enabledModules = null }: { children: React.ReactNode; userName?: string; isSuperAdmin?: boolean; enabledModules?: string[] | null }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="relative flex min-h-screen bg-background">
      <AiBackground />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isSuperAdmin={isSuperAdmin} enabledModules={enabledModules} />
      <div className="relative z-10 flex-1 flex flex-col min-w-0 lg:pl-64">
        <Header userName={userName} onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 min-h-screen px-4 pb-8 pt-20 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

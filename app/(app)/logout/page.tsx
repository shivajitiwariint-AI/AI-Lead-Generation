"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/" });
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <LogOut className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Signing you out…</h1>
      <p className="text-sm text-muted-foreground">Clearing your session and returning to the home page.</p>
    </div>
  );
}

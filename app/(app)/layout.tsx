export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { getAuthContext } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ctx = await getAuthContext();

  if (!ctx.isAuthenticated) {
    redirect("/auth/signin");
  }

  const displayName =
    (ctx.userEmail ? ctx.userEmail.split("@")[0] : "") || "Account";

  return (
    <>
      <OnboardingGuard />
      <AppShell
        userName={displayName}
        isSuperAdmin={ctx.isSuperAdmin}
        enabledModules={(ctx as any).enabledModules ?? null}
      >
        {children}
      </AppShell>
    </>
  );
}

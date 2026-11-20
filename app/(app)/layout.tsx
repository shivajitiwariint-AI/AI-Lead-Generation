export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
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

  // Onboarding gate runs on the server so navigating between pages doesn't
  // trigger an extra client fetch. Super admins and tenants without a profile
  // are never redirected (matching the previous client-side behaviour).
  if (ctx.tenantId && !ctx.isSuperAdmin) {
    const profile = await prisma.companyProfile.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { onboardingCompleted: true },
    });
    if (profile?.onboardingCompleted === false) {
      redirect("/onboarding");
    }
  }

  const displayName =
    (ctx.userEmail ? ctx.userEmail.split("@")[0] : "") || "Account";

  return (
    <AppShell
      userName={displayName}
      isSuperAdmin={ctx.isSuperAdmin}
      enabledModules={ctx.enabledModules ?? null}
    >
      {children}
    </AppShell>
  );
}

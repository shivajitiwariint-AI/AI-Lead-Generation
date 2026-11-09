export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Super admin only" } },
      { status: 403 }
    );
  }

  const tenants = await prisma.tenant.findMany({
    where: { slug: { not: "platform" } },
    orderBy: { createdAt: "desc" },
  });

  const result = await Promise.all(
    tenants.map(async (t) => {
      const [users, leads, qualified, won, emails, meetings, usage] = await Promise.all([
        prisma.tenantUser.count({ where: { tenantId: t.id, status: "ACTIVE" } }),
        prisma.lead.count({ where: { tenantId: t.id } }),
        prisma.lead.count({ where: { tenantId: t.id, status: "qualified" } }),
        prisma.lead.count({ where: { tenantId: t.id, status: "won" } }),
        prisma.message.count({ where: { tenantId: t.id, channel: "email", status: "sent" } }),
        prisma.meeting.count({ where: { tenantId: t.id } }),
        prisma.aICostLog.aggregate({
          where: { tenantId: t.id },
          _sum: { estimatedCost: true },
        }),
      ]);
      const profile = await prisma.companyProfile.findUnique({
        where: { tenantId: t.id },
        select: { industry: true, onboardingCompleted: true },
      });
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        operatingMode: t.operatingMode,
        automationPaused: t.automationPaused,
        enabledModules: t.enabledModules,
        createdAt: t.createdAt,
        industry: profile?.industry ?? null,
        onboardingCompleted: profile?.onboardingCompleted ?? false,
        stats: {
          users,
          leads,
          qualified,
          won,
          emailsSent: emails,
          meetings,
          aiCost: Number(usage._sum.estimatedCost ?? 0),
        },
      };
    })
  );

  return NextResponse.json({ data: result });
}

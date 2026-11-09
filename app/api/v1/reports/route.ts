export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const tenantId = ctx.tenantId!;

  const [totalLeads, leadsByStatus, leadsBySource, conversions] =
    await Promise.all([
      prisma.lead.count({ where: { tenantId } }),
      prisma.lead.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { status: true },
      }),
      prisma.leadSource.groupBy({
        by: ["sourceType"],
        where: { tenantId },
        _count: { sourceType: true },
      }),
      prisma.lead.count({
        where: { tenantId, status: "won" },
      }),
    ]);

    return NextResponse.json({
      totalLeads,
      leadsByStatus: leadsByStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      leadsBySource: leadsBySource.map((s) => ({
        source: s.sourceType,
        count: s._count.sourceType,
      })),
      conversionRate: totalLeads > 0 ? (conversions / totalLeads) * 100 : 0,
      wonCount: conversions,
    });
}

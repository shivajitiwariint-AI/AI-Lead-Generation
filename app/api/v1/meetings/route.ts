export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const rows = await prisma.meeting.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(status ? { status } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
  const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds }, tenantId: ctx.tenantId },
        select: { id: true, name: true, company: true, email: true },
      })
    : [];
  const map = new Map(leads.map((l) => [l.id, l]));
  return NextResponse.json({
    data: rows.map((r) => ({ ...r, lead: map.get(r.leadId) ?? null })),
  });
}

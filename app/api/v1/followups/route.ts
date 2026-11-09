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
  const rows = await prisma.followupTask.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds }, tenantId: ctx.tenantId },
        select: { id: true, name: true, company: true, email: true, status: true },
      })
    : [];
  const map = new Map(leads.map((l) => [l.id, l]));
  const data = rows.map((r) => ({
    ...r,
    lead: map.get(r.leadId) ?? null,
  }));
  const now = new Date();
  const stats = {
    dueToday: rows.filter((r) => r.status === "pending" && r.dueAt <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)).length,
    overdue: rows.filter((r) => r.status === "pending" && r.dueAt < now).length,
    pending: rows.filter((r) => r.status === "pending").length,
    completed: rows.filter((r) => r.status === "completed").length,
    canceled: rows.filter((r) => r.status === "canceled").length,
  };
  return NextResponse.json({ data, stats });
}

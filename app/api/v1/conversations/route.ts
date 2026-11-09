export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

function shape(rows: any[]) {
  return rows.map((c: any) => ({
    ...c,
    _count: { messages: c._count?.messages ?? 0 },
    lead: c.lead ?? null,
  }));
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const rows = await prisma.conversation.findMany({
    where: { tenantId: ctx.tenantId! },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const leadIds = Array.from(new Set(rows.map((c) => c.leadId).filter(Boolean))) as string[];
  const leads = leadIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: leadIds }, tenantId: ctx.tenantId! },
        select: { id: true, name: true, email: true },
      })
    : [];
  const counts = await prisma.chatMessage.groupBy({
    by: ["conversationId"],
    where: { tenantId: ctx.tenantId!, conversationId: { in: rows.map((c) => c.id) } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c: any) => [c.conversationId, c._count._all]));
  const leadMap = new Map(leads.map((l) => [l.id, l]));

  return NextResponse.json(
    shape(
      rows.map((c: any) => ({
        ...c,
        lead: c.leadId ? leadMap.get(c.leadId) ?? null : null,
        _count: { messages: countMap.get(c.id) ?? 0 },
      }))
    )
  );
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const leadId = typeof body?.leadId === "string" ? body.leadId : null;
  if (leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId: ctx.tenantId } });
    if (!lead) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }
  }
  const conv = await prisma.conversation.create({
    data: {
      tenantId: ctx.tenantId,
      leadId,
      visitorRef: `internal-${Date.now()}`,
      status: "open",
    },
  });
  return NextResponse.json({ ...conv, _count: { messages: 0 }, lead: null }, { status: 201 });
}

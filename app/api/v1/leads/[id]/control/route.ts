export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit, recordLeadActivity } from "@/lib/activity";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const controlMode = body.controlMode === "manual" ? "manual" : "ai";
    const lead = await prisma.lead.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
    });
    if (!lead) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }
    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: { controlMode },
    });
    await Promise.all([
      recordLeadActivity({
        tenantId: ctx.tenantId,
        leadId: params.id,
        actorId: ctx.userId,
        activityType: controlMode === "manual" ? "manual_takeover" : "ai_resumed",
        payload: { controlMode },
      }),
      recordAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: controlMode === "manual" ? "lead.manual_takeover" : "lead.ai_resumed",
        category: "lead",
        targetType: "lead",
        targetId: params.id,
        metadata: { leadName: lead.name, controlMode },
      }),
    ]);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

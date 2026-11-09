export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit, recordLeadActivity } from "@/lib/activity";

const patchSchema = z.object({
  status: z.enum(["completed", "canceled", "pending"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  try {
    const { status } = patchSchema.parse(await req.json());
    const existing = await prisma.followupTask.findFirst({ where: { id: params.id, tenantId: ctx.tenantId } });
    if (!existing) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Follow-up not found" } }, { status: 404 });
    }
    const updated = await prisma.followupTask.update({ where: { id: params.id }, data: { status } });
    await Promise.all([
      recordLeadActivity({
        tenantId: ctx.tenantId,
        leadId: existing.leadId,
        actorId: ctx.userId,
        activityType: status === "completed" ? "followup_completed" : status === "canceled" ? "followup_canceled" : "followup_reopened",
        payload: { followupId: params.id, status },
      }),
      recordAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: `followup.${status}`,
        category: "lead",
        targetType: "followup_task",
        targetId: params.id,
        metadata: { leadId: existing.leadId, dueAt: existing.dueAt },
      }),
    ]);
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: err.message } }, { status: 500 });
  }
}

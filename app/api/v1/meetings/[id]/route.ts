export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit, recordLeadActivity } from "@/lib/activity";

const patchSchema = z.object({
  status: z.enum(["scheduled", "completed", "canceled"]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
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
    const data = patchSchema.parse(await req.json());
    const existing = await prisma.meeting.findFirst({ where: { id: params.id, tenantId: ctx.tenantId } });
    if (!existing) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Meeting not found" } }, { status: 404 });
    }
    const updated = await prisma.meeting.update({
      where: { id: params.id },
      data: {
        status: data.status,
        ...(data.startsAt ? { startsAt: new Date(data.startsAt) } : {}),
        ...(data.endsAt ? { endsAt: new Date(data.endsAt) } : {}),
      },
    });
    await Promise.all([
      recordLeadActivity({
        tenantId: ctx.tenantId,
        leadId: existing.leadId,
        actorId: ctx.userId,
        activityType: `meeting_${data.status}`,
        payload: { meetingId: params.id, status: data.status },
      }),
      recordAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: `meeting.${data.status}`,
        category: "lead",
        targetType: "meeting",
        targetId: params.id,
        metadata: { leadId: existing.leadId, startsAt: existing.startsAt },
      }),
    ]);
    if (data.status === "scheduled") {
      await prisma.lead.updateMany({ where: { id: existing.leadId, tenantId: ctx.tenantId }, data: { status: "meeting_scheduled" } });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: err.message } }, { status: 500 });
  }
}

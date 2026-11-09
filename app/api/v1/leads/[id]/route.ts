export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const updateLeadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  requirement: z.string().optional().nullable(),
  status: z.string().optional(),
  ownerId: z.string().optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId! },
  });

  if (!lead) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Lead not found" } },
      { status: 404 }
    );
  }

  const owner = lead.ownerId
    ? await prisma.user.findUnique({
        where: { id: lead.ownerId },
        select: { id: true, name: true, email: true },
      })
    : null;

  return NextResponse.json({
    ...lead,
    ownerName: owner?.name ?? owner?.email ?? null,
    ownerEmail: owner?.email ?? null,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  if (!ctx.permissions.includes("leads:write") && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: leads:write" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const data = updateLeadSchema.parse(body);

    const lead = await prisma.lead.update({
      where: { id: params.id, tenantId: ctx.tenantId! },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        website: data.website,
        industry: data.industry,
        location: data.location,
        requirement: data.requirement,
        status: data.status,
        ownerId: data.ownerId,
        lastContactedAt: data.status ? new Date() : undefined,
      },
    });

    if (data.status) {
      await prisma.leadActivity.create({
        data: {
          tenantId: ctx.tenantId!,
          leadId: params.id,
          actorId: ctx.userId,
          activityType: "status_changed",
          payload: JSON.stringify({ newStatus: data.status }),
        },
      });
    }

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "lead.updated",
      category: "lead",
      targetType: "lead",
      targetId: params.id,
      metadata: { fields: Object.keys(data).filter((k) => (data as any)[k] !== undefined) },
    });

    return NextResponse.json(lead);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Update lead error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to update lead" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  if (!ctx.permissions.includes("leads:delete") && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: leads:delete" } },
      { status: 403 }
    );
  }

  const tenantId = ctx.tenantId!;
  const whereLead = { id: params.id, tenantId };

  const lead = await prisma.lead.findFirst({ where: whereLead });
  if (!lead) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Lead not found" } },
      { status: 404 }
    );
  }

  // Delete ALL related data for this lead (order matters for ids lookup)
  const messages = await prisma.message.findMany({
    where: { leadId: params.id, tenantId },
    select: { id: true },
  });
  const messageIds = messages.map((m) => m.id);

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.leadSource.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.leadActivity.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.leadQualificationResult.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.followupTask.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.campaignLead.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.meeting.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.leadRequirementValue.deleteMany({ where: { leadId: params.id, tenantId } }),
    prisma.consentRecord.deleteMany({ where: { leadId: params.id, tenantId } }),
  ]);

  if (messageIds.length > 0) {
    await prisma.approvalItem.deleteMany({
      where: { tenantId, itemRefId: { in: messageIds } },
    });
  }

  // Detach linked conversations instead of deleting the whole thread
  await prisma.conversation.updateMany({
    where: { leadId: params.id, tenantId },
    data: { leadId: null },
  });

  await prisma.lead.delete({ where: whereLead });

  await recordAudit({
    tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "lead.deleted",
    category: "lead",
    targetType: "lead",
    targetId: params.id,
    metadata: { leadName: lead.name, email: lead.email, deletedMessages: messageIds.length },
  });

  return NextResponse.json({
    ok: true,
    deleted: { messages: messageIds.length },
  });
}

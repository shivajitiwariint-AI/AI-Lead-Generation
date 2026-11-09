export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const assignSchema = z.object({
  // null = unassign
  ownerId: z.string().min(1, "Owner ID is required").nullable(),
});

export async function POST(
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
    const data = assignSchema.parse(body);

    const lead = await prisma.lead.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId! },
    });
    if (!lead) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }

    // Validate owner belongs to this tenant (prevent cross-tenant assign)
    let owner: { id: string; name: string | null; email: string } | null = null;
    if (data.ownerId) {
      const membership = await prisma.tenantUser.findFirst({
        where: { tenantId: ctx.tenantId!, userId: data.ownerId, status: "ACTIVE" },
      });
      if (!membership) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "Owner is not a member of this workspace" } },
          { status: 400 }
        );
      }
      owner = await prisma.user.findUnique({
        where: { id: data.ownerId },
        select: { id: true, name: true, email: true },
      });
    }

    const updated = await prisma.lead.update({
      where: { id: params.id, tenantId: ctx.tenantId! },
      data: { ownerId: data.ownerId },
    });

    await prisma.leadActivity.create({
      data: {
        tenantId: ctx.tenantId!,
        leadId: params.id,
        actorId: ctx.userId,
        activityType: data.ownerId ? "lead_assigned" : "lead_unassigned",
        payload: JSON.stringify({ assignedTo: data.ownerId }),
      },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "lead.assigned",
      category: "lead",
      targetType: "lead",
      targetId: params.id,
      metadata: { ownerId: data.ownerId, ownerEmail: owner?.email ?? null },
    });

    return NextResponse.json({
      ...updated,
      ownerName: owner?.name ?? owner?.email ?? null,
      ownerEmail: owner?.email ?? null,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Assign lead error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to assign lead" } },
      { status: 500 }
    );
  }
}

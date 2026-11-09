export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const followupSchema = z.object({
  dueAt: z.string().datetime(),
  idempotencyKey: z.string().optional(),
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
    const data = followupSchema.parse(body);

    const idempotencyKey = data.idempotencyKey || crypto.randomUUID();

    const existing = await prisma.followupTask.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return NextResponse.json(existing);
    }

    const followup = await prisma.followupTask.create({
      data: {
        tenantId: ctx.tenantId!,
        leadId: params.id,
        dueAt: new Date(data.dueAt),
        idempotencyKey,
        status: "pending",
      },
    });

    await prisma.leadActivity.create({
      data: {
        tenantId: ctx.tenantId!,
        leadId: params.id,
        actorId: ctx.userId,
        activityType: "followup_scheduled",
        payload: JSON.stringify({ dueAt: data.dueAt, followupId: followup.id }),
      },
    });

    return NextResponse.json(followup, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Create follow-up error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to create follow-up" } },
      { status: 500 }
    );
  }
}

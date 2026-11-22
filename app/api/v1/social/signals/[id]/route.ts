export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const schema = z.object({
  status: z.enum(["new", "reviewed", "converted", "discarded"]).optional(),
  relevanceScore: z.number().int().min(0).max(100).optional(),
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
    const data = schema.parse(await req.json());
    const signal = await prisma.socialSignal.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!signal) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Social signal not found" } },
        { status: 404 }
      );
    }
    if (signal.status === "converted" && data.status && data.status !== "converted") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "A converted signal cannot be reopened" } },
        { status: 409 }
      );
    }

    const updated = await prisma.socialSignal.update({
      where: { id: params.id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.relevanceScore != null ? { relevanceScore: data.relevanceScore } : {}),
        updatedAt: new Date(),
      },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "social.signal_updated",
      category: "research",
      targetType: "social_signal",
      targetId: params.id,
      metadata: { status: updated.status, relevanceScore: updated.relevanceScore },
    });

    return NextResponse.json({ ok: true, signal: updated });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

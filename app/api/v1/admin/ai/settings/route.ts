export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { isAIEnabled, setAIEnabled } from "@/lib/ai/settings";
import { recordAudit } from "@/lib/activity";

const bodySchema = z.object({ aiEnabled: z.boolean() });

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Super admin access required" } },
      { status: 403 }
    );
  }
  const aiEnabled = await isAIEnabled();
  // Always report effective state; default true when row missing
  return NextResponse.json({ aiEnabled });
}

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Super admin access required" } },
      { status: 403 }
    );
  }
  try {
    const { aiEnabled } = bodySchema.parse(await req.json());
    const row = await setAIEnabled(aiEnabled, ctx.userId);
    await recordAudit({
      tenantId: null,
      actorId: ctx.userId,
      actorType: "user",
      action: aiEnabled ? "ai.enabled" : "ai.disabled",
      category: "config",
      targetType: "ai_settings",
      targetId: row.id,
      metadata: { aiEnabled },
    });
    return NextResponse.json({ aiEnabled: row.aiEnabled, updatedAt: row.updatedAt });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: err.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

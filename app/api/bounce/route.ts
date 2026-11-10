import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleBounceWebhook } from "@/lib/smtp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Expected payload:
    // { to: "recipient@example.com", bounceReason: "hard_bounce", messageId?: "…" }
    const { tenantId, to, bounceReason, messageId } = body;

    if (!tenantId || !to || !bounceReason) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Missing required fields: tenantId, to, bounceReason" } },
        { status: 400 }
      );
    }

    await handleBounceWebhook({ tenantId, to, bounceReason, messageId });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[bounce] webhook error:", err.message);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
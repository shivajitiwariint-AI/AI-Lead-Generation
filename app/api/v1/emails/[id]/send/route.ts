export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/ai/email";
import { checkSharedRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  // Email sending cap: 100 / hour / tenant (shared via Redis when available)
  const rl = await checkSharedRateLimit(
    [`email-send:tenant:${ctx.tenantId}`, `email-send:user:${ctx.userId}`],
    100,
    60 * 60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Email sending limit reached — wait an hour and try again." } },
      { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
    );
  }

  try {
    const result = await sendEmail({
      tenantId: ctx.tenantId,
      messageId: params.id,
      actorId: ctx.userId,
      actorType: "user",
    });
    const message = await prisma.message.findUnique({ where: { id: params.id } });
    return NextResponse.json({ ...result, message });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 400 }
    );
  }
}

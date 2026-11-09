export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { rejectEmail } from "@/lib/ai/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason ? String(body.reason) : body.note ? String(body.note) : undefined;
    const updated = await rejectEmail({
      tenantId: ctx.tenantId,
      messageId: params.id,
      actorId: ctx.userId,
      note: reason,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 400 }
    );
  }
}

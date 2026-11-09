export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { generateOutreachEmail } from "@/lib/ai/email";
import { recordAudit } from "@/lib/activity";
import { checkSharedRateLimit } from "@/lib/rate-limit";

const generateSchema = z.object({
  leadId: z.string().min(1),
  purpose: z.enum(["intro", "follow_up"]).optional(),
  attachments: z
    .array(z.object({ name: z.string().min(1).max(200), url: z.string().url().max(2000) }))
    .max(10)
    .optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const leadId = searchParams.get("leadId") || undefined;
  const messages = await prisma.message.findMany({
    where: {
      tenantId: ctx.tenantId,
      channel: "email",
      ...(status ? { status } : {}),
      ...(leadId ? { leadId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: messages });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const rl = await checkSharedRateLimit(
    [`email-gen:tenant:${ctx.tenantId}`, `email-gen:user:${ctx.userId}`],
    30,
    60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many email generations — wait a minute and try again." } },
      { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
    );
  }

  try {
    const body = await req.json();
    const data = generateSchema.parse(body);
    const gen = await generateOutreachEmail({
      tenantId: ctx.tenantId,
      leadId: data.leadId,
      purpose: data.purpose ?? "intro",
      actorId: ctx.userId,
      actorType: "user",
      attachments: data.attachments,
    });
    return NextResponse.json(gen, { status: 201 });
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

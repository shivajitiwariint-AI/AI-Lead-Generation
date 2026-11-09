export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { executeResearchRun } from "@/lib/ai/research";
import { enqueueJob } from "@/lib/jobs/worker";
import { recordAudit } from "@/lib/activity";
import { checkSharedRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const runs = await prisma.researchRun.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(runs);
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
    [`research:tenant:${ctx.tenantId}`, `research:user:${ctx.userId}`],
    10,
    60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many research runs — wait a minute and try again." } },
      { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const run = await prisma.researchRun.create({
      data: {
        tenantId: ctx.tenantId,
        sourceId: body.sourceId ?? null,
        query: body.query ?? null,
        criteria: body.criteria ?? undefined,
        status: "pending",
        createdById: ctx.userId,
      },
    });

    // Execute inline (synchronous) so the demo shows immediate results.
    const result = await executeResearchRun({
      tenantId: ctx.tenantId,
      runId: run.id,
      actorId: ctx.userId,
    });

    const fresh = await prisma.researchRun.findUnique({ where: { id: run.id } });
    return NextResponse.json({ run: fresh, result }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

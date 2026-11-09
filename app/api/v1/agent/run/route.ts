export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { runWorkflow } from "@/lib/ai/orchestrator";
import { drainJobs } from "@/lib/jobs/worker";
import { checkSharedRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
  const runs = await prisma.agentRun.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ data: runs });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  // Tenant + user dual limit (shared via Redis when REDIS_URL set)
  const rl = await checkSharedRateLimit(
    [`agent-run:tenant:${ctx.tenantId}`, `agent-run:user:${ctx.userId}`],
    10,
    60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many AI workflow runs — wait a minute and try again." } },
      { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const leadId = body.leadId ? String(body.leadId) : undefined;
    const result = await runWorkflow({
      tenantId: ctx.tenantId,
      trigger: "manual",
      actorId: ctx.userId,
      leadId,
      limits: { maxLeads: body.maxLeads ? Number(body.maxLeads) : 10 },
    });
    await drainJobs({ tenantId: ctx.tenantId, limit: 10 }).catch(() => {});
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

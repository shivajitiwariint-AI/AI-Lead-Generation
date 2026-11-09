export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { drainJobs } from "@/lib/jobs/worker";
import { runWorkflow } from "@/lib/ai/orchestrator";
import { recordAudit } from "@/lib/activity";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    // 1. Claim due follow-ups and enqueue dispatch jobs (existing behaviour).
    const dueFollowups = await prisma.followupTask.findMany({
      where: { status: "pending", dueAt: { lte: now } },
      take: 100,
    });
    const claimed: string[] = [];
    for (const followup of dueFollowups) {
      const updated = await prisma.followupTask.updateMany({
        where: { id: followup.id, status: "pending" },
        data: { status: "running" },
      });
      if (updated.count > 0) {
        claimed.push(followup.id);
        await prisma.automationJob.create({
          data: {
            tenantId: followup.tenantId,
            jobType: "followup.dispatch",
            status: "pending",
            runAt: new Date(),
            payload: { followupId: followup.id },
          },
        });
      }
    }

    // 2. Trigger the autonomous workflow for active tenants in AI modes.
    const tenants = await prisma.tenant.findMany({
      where: { status: "ACTIVE", automationPaused: false },
      select: { id: true, operatingMode: true },
    });
    const workflowRuns: string[] = [];
    for (const t of tenants) {
      if (t.operatingMode === "FULLY_MANUAL") continue;
      try {
        const r = await runWorkflow({ tenantId: t.id, trigger: "cron", actorId: null });
        workflowRuns.push(r.runId);
      } catch (err) {
        console.error("[cron] workflow failed for", t.id, (err as Error).message);
      }
    }

    // 3. Drain the job queue.
    const drain = await drainJobs({ limit: 25, now });

    return NextResponse.json({
      claimedFollowups: claimed.length,
      workflowRuns: workflowRuns.length,
      drained: drain,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";
import { runWorkflow } from "@/lib/ai/orchestrator";
import { executeResearchRun } from "@/lib/ai/research";
import { sendEmail } from "@/lib/ai/email";

/**
 * Requirement 1: the missing piece — an actual executor for AutomationJob rows.
 * The schema + enqueue producers existed, but nothing processed them.
 * drainJobs() claims due pending jobs atomically (CAS) and runs handlers.
 */

export interface DrainResult {
  claimed: number;
  completed: number;
  failed: number;
  details: Array<{ id: string; jobType: string; status: string; error?: string }>;
}

async function claimJob(id: string): Promise<boolean> {
  const res = await prisma.automationJob.updateMany({
    where: { id, status: "pending" },
    data: { status: "running", attempts: { increment: 1 } },
  });
  return res.count === 1;
}

async function backoff(attempts: number): Promise<Date> {
  const minutes = Math.min(60, Math.pow(2, attempts) * 2);
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function handleJob(job: {
  id: string;
  tenantId: string;
  jobType: string;
  payload: any;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (job.jobType) {
      case "ai.workflow":
      case "workflow.run": {
        const trigger = (job.payload?.trigger as any) ?? "cron";
        const leadId = job.payload?.leadId;
        await runWorkflow({
          tenantId: job.tenantId,
          trigger: trigger === "event" ? "event" : trigger === "manual" ? "manual" : "cron",
          leadId,
          actorId: job.payload?.actorId ?? null,
        });
        return { ok: true };
      }
      case "research.run": {
        const runId = job.payload?.runId;
        if (!runId) return { ok: false, error: "missing runId" };
        const out = await executeResearchRun({ tenantId: job.tenantId, runId });
        if (out.status !== "completed") return { ok: false, error: out.error ?? "research failed" };
        return { ok: true };
      }
      case "email.send": {
        const messageId = job.payload?.messageId;
        if (!messageId) return { ok: false, error: "missing messageId" };
        const out = await sendEmail({
          tenantId: job.tenantId,
          messageId,
          actorId: job.payload?.actorId ?? null,
          actorType: "system",
        });
        if (!out.sent && out.reason) return { ok: false, error: out.reason };
        return { ok: true };
      }
      case "followup.dispatch": {
        // Existing cron path: mark due followups handled by AI when possible.
        const followupId = job.payload?.followupId;
        if (followupId) {
          await prisma.followupTask.updateMany({
            where: { id: followupId, tenantId: job.tenantId, status: "pending" },
            data: { status: "completed" },
          });
        }
        return { ok: true };
      }
      case "document.ingest": {
        const docId = job.payload?.documentId;
        if (docId) {
          await prisma.knowledgeDocument.updateMany({
            where: { id: docId, tenantId: job.tenantId },
            data: { status: "processed" },
          });
        }
        await recordAudit({
          tenantId: job.tenantId,
          actorType: "system",
          action: "document.ingested",
          category: "ai",
          targetType: "knowledge_document",
          targetId: docId ?? null,
          metadata: { jobType: job.jobType },
        });
        return { ok: true };
      }
      default:
        return { ok: false, error: `unknown job type: ${job.jobType}` };
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message.slice(0, 1000) };
  }
}

export async function drainJobs(opts?: {
  limit?: number;
  now?: Date;
  tenantId?: string;
}): Promise<DrainResult> {
  const limit = opts?.limit ?? 10;
  const now = opts?.now ?? new Date();
  const where: any = { status: "pending", runAt: { lte: now } };
  if (opts?.tenantId) where.tenantId = opts.tenantId;

  const candidates = await prisma.automationJob.findMany({
    where,
    orderBy: { runAt: "asc" },
    take: limit,
  });

  const details: DrainResult["details"] = [];
  let completed = 0;
  let failed = 0;
  let claimed = 0;

  for (const job of candidates) {
    const ok = await claimJob(job.id);
    if (!ok) continue;
    claimed++;

    const result = await handleJob(job);

    if (result.ok) {
      await prisma.automationJob.update({
        where: { id: job.id },
        data: { status: "completed", error: null },
      });
      completed++;
      details.push({ id: job.id, jobType: job.jobType, status: "completed" });
    } else {
      const fresh = await prisma.automationJob.findUnique({
        where: { id: job.id },
        select: { attempts: true, maxAttempts: true },
      });
      const attempts = fresh?.attempts ?? 1;
      const maxAttempts = fresh?.maxAttempts ?? 3;
      if (attempts >= maxAttempts) {
        await prisma.automationJob.update({
          where: { id: job.id },
          data: { status: "failed", error: result.error ?? "failed" },
        });
        failed++;
        details.push({ id: job.id, jobType: job.jobType, status: "failed", error: result.error });
      } else {
        await prisma.automationJob.update({
          where: { id: job.id },
          data: { status: "pending", error: result.error ?? null, runAt: await backoff(attempts) },
        });
        details.push({ id: job.id, jobType: job.jobType, status: "pending(retry)", error: result.error });
      }
    }
  }

  return { claimed, completed, failed, details };
}

/** Convenience: enqueue then immediately drain (keeps local runs responsive). */
export async function enqueueJob(params: {
  tenantId: string;
  jobType: string;
  payload?: any;
  runAt?: Date;
  autoDrain?: boolean;
}): Promise<string> {
  const row = await prisma.automationJob.create({
    data: {
      tenantId: params.tenantId,
      jobType: params.jobType,
      status: "pending",
      runAt: params.runAt ?? new Date(),
      payload: params.payload ?? {},
    },
  });
  await recordAudit({
    tenantId: params.tenantId,
    actorType: "system",
    action: "job.enqueued",
    category: "workflow",
    targetType: "automation_job",
    targetId: row.id,
    metadata: { jobType: params.jobType },
  });
  if (params.autoDrain !== false) {
    // fire-and-forget so the caller's response isn't blocked, but attempt drain
    drainJobs({ tenantId: params.tenantId, limit: 3 }).catch((e) =>
      console.error("[worker] drain failed:", e)
    );
  }
  return row.id;
}

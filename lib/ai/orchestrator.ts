import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { recordAudit, recordLeadActivity } from "@/lib/activity";
import { generateText } from "@/lib/ai-gateway";
import { qualifyAndMatchLead } from "@/lib/ai/qualification";
import { generateOutreachEmail, sendEmail } from "@/lib/ai/email";
import { executeResearchRun } from "@/lib/ai/research";
import { getRealEstateConfig } from "@/lib/ai/real-estate";
import { getSoftwareConfig } from "@/lib/ai/software-outreach";
import { isAIEnabled, isAITenantEnabled } from "@/lib/ai/settings";

/**
 * Requirement 1: autonomous AI sales workflow.
 * Requirement 2: honors the tenant's operating mode.
 * Requirement 8: honors the global takeover switch + per-lead controlMode.
 *
 * One run = one AgentRun with a step-by-step progress trail (req 7).
 */

export type StepStatus = "ok" | "skipped" | "failed";

export interface WorkflowStep {
  step: string;
  status: StepStatus;
  detail?: string;
  at: string;
}

export interface WorkflowMetrics {
  researchRuns: number;
  leadsCreated: number;
  leadsQualified: number;
  emailsDrafted: number;
  emailsSent: number;
  emailsPendingApproval: number;
  meetingsProposed: number;
  followupsHandled: number;
}

export interface WorkflowResult {
  runId: string;
  status: "completed" | "paused" | "failed";
  mode: string;
  paused: boolean;
  steps: WorkflowStep[];
  summary: string;
  metrics: WorkflowMetrics;
}

interface RunOptions {
  tenantId: string;
  trigger?: "manual" | "cron" | "event";
  actorId?: string | null;
  leadId?: string;
  limits?: { maxLeads?: number };
}

export async function runWorkflow(opts: RunOptions): Promise<WorkflowResult> {
  const { tenantId, trigger = "manual", actorId = null, leadId, limits } = opts;
  const maxLeads = limits?.maxLeads ?? 10;
  const steps: WorkflowStep[] = [];
  const metrics: WorkflowMetrics = {
    researchRuns: 0,
    leadsCreated: 0,
    leadsQualified: 0,
    emailsDrafted: 0,
    emailsSent: 0,
    emailsPendingApproval: 0,
    meetingsProposed: 0,
    followupsHandled: 0,
  };
  const push = (step: string, status: StepStatus, detail?: string) =>
    steps.push({ step, status, detail, at: new Date().toISOString() });

  const run = await prisma.agentRun.create({
    data: {
      tenantId,
      trigger,
      mode: "AI_WITH_APPROVAL", // snapshot placeholder, set below
      status: "running",
      leadId: leadId ?? null,
      steps: [] as any,
    },
  });

  const finish = async (status: WorkflowResult["status"], summary: string) => {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status, summary, steps: steps as any, finishedAt: new Date() },
    });
  };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    await finish("failed", "Tenant not found");
    return { runId: run.id, status: "failed", mode: "unknown", paused: true, steps, summary: "Tenant not found", metrics };
  }

  const mode = tenant.operatingMode;
  await prisma.agentRun.update({ where: { id: run.id }, data: { mode } });

  // Global AI kill-switch (admin) — skip every AI stage, spend no tokens
  if (!(await isAIEnabled()) || !(await isAITenantEnabled(tenantId))) {
    push("load_context", "skipped", "AI is disabled by admin.");
    await finish("paused", "AI disabled by admin — no model calls made.");
    return { runId: run.id, status: "paused", mode: tenant.operatingMode, paused: true, steps, summary: "AI disabled by admin.", metrics };
  }

  // Global takeover switch (req 8)
  if (tenant.automationPaused) {
    push("load_context", "skipped", "Automation is paused (manual takeover active).");
    await finish("paused", "Automation paused — manual takeover active.");
    return { runId: run.id, status: "paused", mode, paused: true, steps, summary: "Automation paused.", metrics };
  }
  if (mode === "FULLY_MANUAL") {
    push("load_context", "skipped", "Operating mode is Fully Manual.");
    await finish("paused", "Operating mode is Fully Manual — no AI actions taken.");
    return { runId: run.id, status: "paused", mode, paused: true, steps, summary: "Fully manual mode.", metrics };
  }
  push("load_context", "ok", `Mode: ${mode}.`);

  // Optional single-lead scoping
  const scopeLeadId = leadId;

  // ----- Stage: research / lead discovery (per-country schedules) -----
  try {
    const profile = await prisma.companyProfile.findUnique({
      where: { tenantId },
    });
    const target = ((profile?.targetMarket ?? {}) as Record<string, any>) ?? {};
    const locations: string[] = Array.isArray(target.locations)
      ? target.locations.filter((x: any) => typeof x === "string" && x.trim())
      : [];
    const freqMap = ((target.searchFrequencies ?? {}) as Record<string, any>) ?? {};
    const segments = Array.isArray(target.segments) ? target.segments.join(", ") : "";
    const reConfig = getRealEstateConfig(profile as any);
    const swConfig = getSoftwareConfig(profile as any);
    const perSearch = swConfig.enabled ? swConfig.maxResults || 5 : reConfig.maxResults || 5;

    const [pendingCount, recentRuns] = await Promise.all([
      prisma.researchRun.count({ where: { tenantId, status: "pending" } }),
      prisma.researchRun.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    // Determine which countries are due.
    // - Manual (Ask AI button): always search every enabled country (explicit user intent).
    // - Cron: only search countries whose interval has elapsed since last run (saves tokens).
    const now = Date.now();
    const dueCountries: string[] = [];
    let skippedDue = 0;

    const countriesToCheck = locations.length ? locations : [""];
    for (const country of countriesToCheck) {
      const key = country || "all";
      const cfg = freqMap[key] ?? (country ? freqMap[country] : undefined);
      const enabled = cfg?.enabled === undefined ? true : !!cfg.enabled;
      if (!enabled) continue;

      if (trigger === "manual" || scopeLeadId) {
        if (country) dueCountries.push(country);
        continue;
      }

      const everyHours = Number(cfg?.everyHours ?? 24) || 24;
      const last = country
        ? recentRuns.find((r) => {
            const loc = (r.criteria as any)?.location;
            if (typeof loc !== "string") return false;
            const needle = country.toLowerCase();
            return (
              loc.toLowerCase() === needle ||
              loc.toLowerCase().split(",").map((s) => s.trim()).includes(needle)
            );
          })
        : null;
      const lastAt = last ? (last.completedAt ?? last.createdAt).getTime() : null;
      const due = lastAt == null || now - lastAt >= everyHours * 3600000;
      if (due) {
        if (country) dueCountries.push(country);
      } else {
        skippedDue++;
      }
    }

    if (!scopeLeadId && pendingCount === 0 && dueCountries.length > 0) {
      for (const country of dueCountries) {
        await prisma.researchRun.create({
          data: {
            tenantId,
            query: [
              profile?.description,
              segments ? `Target segments: ${segments}` : "",
              country ? `Location: ${country}` : "",
            ]
              .filter(Boolean)
              .join(". ")
              .slice(0, 500) || "Find new B2B customers matching our target market.",
            criteria: {
              ...(profile?.industry ? { industry: profile.industry } : {}),
              ...(country ? { location: country } : {}),
              ...(segments ? { keywords: segments } : {}),
              maxResults: perSearch,
            },
            status: "pending",
            createdById: actorId,
          },
        });
      }
      push(
        "discover",
        "ok",
        `Created ${dueCountries.length} discovery run(s): ${dueCountries.join(", ")}.`
      );
    } else if (!scopeLeadId && pendingCount === 0 && dueCountries.length === 0) {
      push(
        "discover",
        "skipped",
        skippedDue > 0
          ? `${skippedDue} country(ies) not due yet (per schedule).`
          : "No countries configured / all disabled."
      );
    }

    const pendingRuns = await prisma.researchRun.findMany({
      where: { tenantId, status: "pending" },
      take: 5,
      orderBy: { createdAt: "asc" },
    });
    if (pendingRuns.length === 0) {
      push("research", "skipped", "No pending research runs.");
    } else {
      let totalCreated = 0;
      for (const r of pendingRuns) {
        const out = await executeResearchRun({ tenantId, runId: r.id, actorId });
        totalCreated += out.createdCount;
      }
      metrics.researchRuns += pendingRuns.length;
      metrics.leadsCreated += totalCreated;
      push("research", "ok", `${pendingRuns.length} run(s) executed, ${totalCreated} new lead(s).`);
    }
  } catch (err) {
    push("research", "failed", (err as Error).message.slice(0, 200));
  }

  // ----- Stage: qualify + match (req 5) -----
  try {
    const candidates = await prisma.lead.findMany({
      where: {
        tenantId,
        controlMode: "ai",
        ...(scopeLeadId ? { id: scopeLeadId } : {}),
        status: { in: ["new", "unreviewed"] },
      },
      orderBy: { createdAt: "desc" },
      take: maxLeads,
    });
    let qualified = 0;
    for (const l of candidates) {
      try {
        const out = await qualifyAndMatchLead({
          tenantId,
          leadId: l.id,
          actorId,
          actorType: "ai",
        });
        qualified++;
        // audit roll-up handled per-lead; orchestrator audit for stage summary below
      } catch (err) {
        console.error("[orchestrator] qualify failed for", l.id, (err as Error).message);
      }
    }
    metrics.leadsQualified += qualified;
    push("qualify", candidates.length ? "ok" : "skipped", `${qualified}/${candidates.length} lead(s) qualified & matched.`);
  } catch (err) {
    push("qualify", "failed", (err as Error).message.slice(0, 200));
  }

  // ----- Stage: outreach (req 6) -----
  try {
    const qualifiedLeads = await prisma.lead.findMany({
      where: {
        tenantId,
        controlMode: "ai",
        ...(scopeLeadId ? { id: scopeLeadId } : {}),
        status: "qualified",
        email: { not: null },
        lastContactedAt: null,
      },
      orderBy: { score: "desc" },
      take: maxLeads,
    });
    let drafted = 0;
    let sent = 0;
    let pending = 0;
    for (const l of qualifiedLeads) {
      // skip suppressed contacts
      const suppressed = await prisma.suppressionEntry.findFirst({
        where: { tenantId, contactHash: emailHash(l.email!), channel: "email" },
      });
      if (suppressed) continue;

      try {
        const gen = await generateOutreachEmail({
          tenantId,
          leadId: l.id,
          purpose: "intro",
          actorId,
          actorType: "ai",
        });
        drafted++;
        if (gen.status === "approved") {
          await sendEmail({ tenantId, messageId: gen.messageId, actorId, actorType: "ai" });
          sent++;
        } else {
          pending++;
        }
      } catch (err) {
        console.error("[orchestrator] outreach failed for", l.id, (err as Error).message);
      }
    }
    metrics.emailsDrafted += drafted;
    metrics.emailsSent += sent;
    metrics.emailsPendingApproval += pending;
    push(
      "outreach",
      qualifiedLeads.length ? "ok" : "skipped",
      `${drafted} email(s) drafted — ${sent} sent, ${pending} awaiting approval.`
    );
  } catch (err) {
    push("outreach", "failed", (err as Error).message.slice(0, 200));
  }

  // ----- Stage: meetings (req 9) -----
  try {
    const hotLeads = await prisma.lead.findMany({
      where: {
        tenantId,
        controlMode: "ai",
        ...(scopeLeadId ? { id: scopeLeadId } : {}),
        status: "qualified",
        score: { gte: 60 },
      },
      orderBy: { score: "desc" },
      take: 3,
    });
    let proposed = 0;
    for (const l of hotLeads) {
      const existingMeeting = await prisma.meeting.findFirst({
        where: { tenantId, leadId: l.id, status: { in: ["proposed", "scheduled"] } },
      });
      if (existingMeeting) continue;
      const starts = new Date();
      starts.setDate(starts.getDate() + 2);
      starts.setHours(10, 0, 0, 0);
      const ends = new Date(starts);
      ends.setMinutes(ends.getMinutes() + 30);
      await prisma.meeting.create({
        data: {
          tenantId,
          leadId: l.id,
          title: `Discovery call — ${l.name}`,
          startsAt: starts,
          endsAt: ends,
          status: "proposed",
          notes: "Proposed by AI based on high qualification score. Awaiting confirmation.",
          createdBy: "ai",
        },
      });
      await recordLeadActivity({
        tenantId,
        leadId: l.id,
        actorId,
        activityType: "meeting_proposed",
        payload: { title: `Discovery call — ${l.name}`, startsAt: starts.toISOString() },
      });
      proposed++;
    }
    metrics.meetingsProposed += proposed;
    push("meetings", hotLeads.length ? "ok" : "skipped", `${proposed} meeting(s) proposed.`);
  } catch (err) {
    push("meetings", "failed", (err as Error).message.slice(0, 200));
  }

  // ----- Stage: follow-ups -----
  try {
    const due = await prisma.followupTask.findMany({
      where: { tenantId, status: "pending", dueAt: { lte: new Date() } },
      take: maxLeads,
    });
    let handled = 0;
    for (const f of due) {
      const lead = await prisma.lead.findFirst({ where: { id: f.leadId, tenantId } });
      if (!lead || lead.controlMode !== "ai") continue;
      // For now: mark processed + record an AI follow-up activity; email drafted in outreach stage already covers intro.
      await prisma.followupTask.update({
        where: { id: f.id },
        data: { status: "completed" },
      });
      await recordLeadActivity({
        tenantId,
        leadId: f.leadId,
        actorId,
        activityType: "followup_completed",
        payload: { followupId: f.id, handledBy: "ai" },
      });
      handled++;
    }
    metrics.followupsHandled += handled;
    push("followups", due.length ? "ok" : "skipped", `${handled}/${due.length} due follow-up(s) handled.`);
  } catch (err) {
    push("followups", "failed", (err as Error).message.slice(0, 200));
  }

  const summary = steps
    .filter((s) => s.status === "ok" || s.status === "failed")
    .map((s) => `${s.step}: ${s.detail ?? s.status}`)
    .join(" | ");

  await recordAudit({
    tenantId,
    actorId,
    actorType: "ai",
    action: "workflow.completed",
    category: "workflow",
    targetType: "agent_run",
    targetId: run.id,
    metadata: { trigger, mode, steps: steps.length, summary, metrics },
  });

  await finish("completed", summary);
  return { runId: run.id, status: "completed", mode, paused: false, steps, summary, metrics };
}

// helper re-exported for orchestrator consumers
export function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

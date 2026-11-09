import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai-gateway";
import { recordAudit, recordLeadActivity, type ActorType } from "@/lib/activity";
import { loadOffers, matchOffers, type OfferMatch } from "@/lib/ai/matching";
import { getRealEstateConfig, buildQualificationFragment } from "@/lib/ai/real-estate";
import { getSoftwareConfig, buildQualificationFragment as buildSoftwareQualFragment } from "@/lib/ai/software-outreach";
import type { Prisma } from "@prisma/client";

/**
 * Requirement 5: AI lead qualification + offer matching, shared by the
 * per-lead API endpoint and the autonomous orchestrator. Uses the AI gateway
 * (real provider or local engine) and persists an explainable result.
 */

export interface QualifyLeadOptions {
  tenantId: string;
  leadId: string;
  actorId?: string | null;
  actorType?: ActorType;
  campaignId?: string;
}

export interface QualifyLeadOutcome {
  qualificationId: string;
  totalScore: number;
  band: "Hot" | "Warm" | "Cold";
  fitScore: number;
  intentScore: number;
  urgencyScore: number;
  completenessScore: number;
  summary: string;
  nextAction: string;
  confidence: string;
  matchScore: number | null;
  matchedOffers: OfferMatch[];
  mock: boolean;
}

const QUAL_SYSTEM = `You are a B2B lead qualification assistant.
Score the lead 0-100 on each dimension and give a concise, factual summary.
Respond with ONLY a JSON object:
{"fitScore":number,"intentScore":number,"urgencyScore":number,"completenessScore":number,"summary":string,"nextAction":string,"confidence":"high"|"medium"|"low"}
Mark uncertain information as "unknown" rather than inventing it.`;

/** Deterministic baseline scores (used when the model returns unusable output). */
function heuristicScores(lead: {
  requirement?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}) {
  const text = (lead.requirement || "").toLowerCase();
  const hasBudget = text.includes("budget") || text.includes("$");
  const hasTimeline = /timeline|month|week|asap|immediate/.test(text);

  let fitScore = 40;
  if (lead.company) fitScore += 15;
  if (lead.email) fitScore += 10;
  if (hasBudget) fitScore += 15;
  if (hasTimeline) fitScore += 10;
  fitScore = Math.min(100, fitScore);

  let intentScore = 30;
  if (text.includes("looking for") || text.includes("need")) intentScore += 20;
  if (text.includes("urgent") || text.includes("asap")) intentScore += 25;
  if (hasBudget) intentScore += 15;
  intentScore = Math.min(100, intentScore);

  const urgencyScore = text.includes("immediate") ? 90 : hasTimeline ? 70 : 30;

  let completeness = 20;
  if (lead.name) completeness += 20;
  if (lead.email) completeness += 20;
  if (lead.phone) completeness += 20;
  if (lead.company) completeness += 20;

  return {
    fitScore,
    intentScore,
    urgencyScore,
    completenessScore: Math.min(100, completeness),
    summary: (lead.requirement || "No requirement provided").slice(0, 200),
    nextAction:
      fitScore >= 70
        ? "Assign to senior sales rep for immediate follow-up"
        : fitScore >= 40
          ? "Add to nurture campaign and follow up within 3 days"
          : "Send informational materials and qualify further",
    confidence: fitScore >= 60 ? "high" : fitScore >= 30 ? "medium" : "low",
  };
}

function safeParseModelJson(raw: string): Record<string, any> | null {
  const text = raw.trim();
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object") return direct;
  } catch {
    /* try extracting a block below */
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* fall through */
    }
  }
  return null;
}

const clampScore = (v: unknown, fallback: number): number => {
  const n = Number(v);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
};

export async function qualifyAndMatchLead(
  opts: QualifyLeadOptions
): Promise<QualifyLeadOutcome> {
  const { tenantId, leadId } = opts;

  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
  if (!lead) throw new Error("Lead not found");

  const profile = await prisma.companyProfile.findUnique({ where: { tenantId } });
  let offers = loadOffers(profile as any);
  const reConfig = getRealEstateConfig(profile as any);
  const swConfig = getSoftwareConfig(profile as any);

  // If the company never filled product/service catalog, derive offers from
  // the admin-managed Real Estate / Software packs so matching still works.
  if (!offers.length) {
    const fallback: any[] = [];
    if (reConfig.enabled) {
      for (const t of reConfig.propertyTypes) {
        fallback.push({ name: `${t}`, offerType: "property", description: `Real estate: ${t}`, keywords: [t] });
      }
    }
    if (swConfig.enabled) {
      for (const s of swConfig.services) {
        fallback.push({ name: `${s}`, offerType: "service", description: `Software: ${s}`, keywords: [s] });
      }
    }
    if (fallback.length) offers = fallback;
  }

  const prompt = [
    `Lead: ${lead.name}`,
    `Company: ${lead.company ?? "unknown"}`,
    `Industry: ${lead.industry ?? "unknown"}`,
    `Location: ${lead.location ?? "unknown"}`,
    `Contact: email=${lead.email ?? "none"}, phone=${lead.phone ?? "none"}`,
    `Requirement: ${lead.requirement ?? "not provided"}`,
    ...buildQualificationFragment(reConfig),
    ...buildSoftwareQualFragment(swConfig),
    offers.length
      ? `Company offers: ${offers.map((o) => `${o.name} (${o.offerType})`).join("; ")}`
      : `Company offers: not configured`,
    `Sales objective: ${
      Array.isArray((profile as any)?.salesObjectives)
        ? ((profile as any).salesObjectives as any[])
            .map((o) => o?.objective)
            .filter(Boolean)
            .join("; ") || "not set"
        : "not set"
    }`,
  ].join("\n");

  const ai = await generateText({
    moduleKey: "lead_qualification",
    tenantId,
    prompt,
    systemPrompt: QUAL_SYSTEM,
    maxTokens: 1000,
    temperature: 0.2,
  });

  const fallback = heuristicScores(lead);
  const parsed = safeParseModelJson(ai.text);

  const aiSummary = parsed?.summary ? String(parsed.summary).slice(0, 1000) : fallback.summary;
  const fitScore = clampScore(parsed?.fitScore, fallback.fitScore);
  const intentScore = clampScore(parsed?.intentScore, fallback.intentScore);
  const urgencyScore = clampScore(parsed?.urgencyScore, fallback.urgencyScore);
  const completenessScore = clampScore(
    parsed?.completenessScore,
    fallback.completenessScore
  );
  const nextAction = parsed?.nextAction ? String(parsed.nextAction) : fallback.nextAction;
  const confidence = ["high", "medium", "low"].includes(String(parsed?.confidence))
    ? String(parsed!.confidence)
    : fallback.confidence;

  // Requirement 5: deterministic offer matching (+ AI-suggested matches if given)
  const { matchScore, matches } = matchOffers(
    {
      requirement: lead.requirement,
      industry: lead.industry,
      company: lead.company,
      location: lead.location,
    },
    offers
  );
  const aiMatches: OfferMatch[] = Array.isArray(parsed?.matchedOffers)
    ? parsed.matchedOffers
        .filter((m: any) => m?.offer)
        .map((m: any) => ({
          offer: String(m.offer),
          offerType: (["product", "service", "property"].includes(m.offerType)
            ? m.offerType
            : "service") as OfferMatch["offerType"],
          score: clampScore(m.score, 50),
          reason: m.reason ? String(m.reason) : "AI-suggested match.",
        }))
    : [];
  const byName = new Map<string, OfferMatch>();
  for (const m of [...matches, ...aiMatches]) {
    const prev = byName.get(m.offer);
    if (!prev || m.score > prev.score) byName.set(m.offer, m);
  }
  const matchedOffers = Array.from(byName.values()).sort((a, b) => b.score - a.score).slice(0, 5);
  const effectiveMatchScore = matchedOffers.length
    ? Math.max(matchScore, matchedOffers[0].score)
    : matchScore;

  const totalScore = Math.round(
    fitScore * 0.3 + intentScore * 0.25 + urgencyScore * 0.2 + completenessScore * 0.15 + 10
  );
  const band: "Hot" | "Warm" | "Cold" =
    totalScore >= 80 ? "Hot" : totalScore >= 50 ? "Warm" : "Cold";

  // Stale pending rows → failed (kept from previous behaviour)
  await prisma.leadQualificationResult.updateMany({
    where: { leadId, tenantId, processingStatus: "pending" },
    data: { processingStatus: "failed" },
  });

  const qualification = await prisma.leadQualificationResult.create({
    data: {
      tenantId,
      leadId,
      campaignId: opts.campaignId || "",
      fitScore,
      intentScore,
      urgencyScore,
      completenessScore,
      summary: aiSummary,
      evidence: {
        missingAnswers: [
          ...(!lead.email ? ["Email address"] : []),
          ...(!lead.phone ? ["Phone number"] : []),
          ...(!lead.company ? ["Company name"] : []),
        ],
        heuristic: fallback,
        matchedOfferCount: matchedOffers.length,
        generatedBy: ai.mock ? "local_engine" : "provider",
      } as Prisma.InputJsonValue,
      nextAction,
      modelId: ai.modelId,
      promptVersion: "v2.0-match",
      confidence,
      tokenUsage: ai.inputTokens + ai.outputTokens,
      estimatedCost: ai.estimatedCost,
      processingStatus: "completed",
      matchScore: effectiveMatchScore,
      matchedOffers: matchedOffers as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      score: totalScore,
      status: (band === "Hot" || band === "Warm") && ["new", "unreviewed"].includes(lead.status)
        ? "qualified"
        : lead.status,
      aiSummary,
      lastAiActionAt: new Date(),
    },
  });

  const payload = {
    qualificationId: qualification.id,
    fitScore,
    intentScore,
    urgencyScore,
    band,
    totalScore,
    matchScore: effectiveMatchScore,
    matchedOffers: matchedOffers.map((m) => m.offer),
    model: ai.modelId,
    mock: ai.mock,
  };

  await Promise.all([
    recordLeadActivity({
      tenantId,
      leadId,
      actorId: opts.actorId ?? null,
      activityType: "ai_qualification_completed",
      payload,
    }),
    recordAudit({
      tenantId,
      actorId: opts.actorId ?? null,
      actorType: opts.actorType ?? (ai.mock || !opts.actorId ? "ai" : "user"),
      action: "lead.qualified",
      category: "lead",
      targetType: "lead",
      targetId: leadId,
      metadata: payload,
    }),
  ]);

  return {
    qualificationId: qualification.id,
    totalScore,
    band,
    fitScore,
    intentScore,
    urgencyScore,
    completenessScore,
    summary: aiSummary,
    nextAction,
    confidence,
    matchScore: effectiveMatchScore,
    matchedOffers,
    mock: ai.mock,
  };
}

import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai-gateway";
import { recordAudit, recordLeadActivity } from "@/lib/activity";
import { loadOffers } from "@/lib/ai/matching";
import { getRealEstateConfig, buildResearchFragment } from "@/lib/ai/real-estate";
import { getSoftwareConfig, buildResearchFragment as buildSoftwareResearchFragment } from "@/lib/ai/software-outreach";
import type { Prisma } from "@prisma/client";

/**
 * Requirement 4: online research using approved sources.
 * executeResearchRun() is shared by the research API and the orchestrator.
 */

export interface RunResearchOptions {
  tenantId: string;
  runId: string;
  actorId?: string | null;
}

function slugEmail(name: string, company: string): string {
  const first = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  const dom = company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "example";
  return `${first}@${dom}.com`;
}

export async function executeResearchRun(opts: RunResearchOptions): Promise<{
  runId: string;
  status: string;
  foundCount: number;
  createdCount: number;
  error?: string;
}> {
  const { tenantId, runId } = opts;

  const run = await prisma.researchRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw new Error("Research run not found");
  const source = run.sourceId
    ? await prisma.researchSource.findFirst({ where: { id: run.sourceId, tenantId, approved: true } })
    : null;
  if (run.sourceId && !source) throw new Error("Research source not approved or missing");

  const profile = await prisma.companyProfile.findUnique({ where: { tenantId } });

  await prisma.researchRun.update({
    where: { id: runId },
    data: { status: "running", startedAt: new Date() },
  });
  await recordAudit({
    tenantId,
    actorId: opts.actorId ?? null,
    actorType: "ai",
    action: "research.started",
    category: "research",
    targetType: "research_run",
    targetId: runId,
    metadata: { sourceId: run.sourceId, query: run.query },
  });

  try {
    const offers = loadOffers(profile as any);
    const criteria = (run.criteria ?? {}) as Record<string, any>;
    const reConfig = getRealEstateConfig(profile as any);
    const swConfig = getSoftwareConfig(profile as any);
    const fallbackPerSearch = swConfig.enabled ? swConfig.maxResults : reConfig.maxResults;
    const maxResults = Math.min(Math.max(Number(criteria.maxResults) || fallbackPerSearch || 5, 1), 20);
    const prompt = [
      `Company: ${profile?.description ?? "a business seeking new customers"}`,
      `Industry focus: ${criteria.industry ?? profile?.industry ?? "general"}`,
      `Location: ${criteria.location ?? "any"}`,
      `Company size: ${criteria.companySize ?? "any"}`,
      `Keywords: ${criteria.keywords ?? ""}`,
      `Sales objectives: ${
        Array.isArray(profile?.salesObjectives)
          ? (profile!.salesObjectives as any[]).map((o) => o?.objective).filter(Boolean).join("; ")
          : "not set"
      }`,
      `Offer catalog: ${offers.map((o) => o.name).join(", ") || "generic services"}`,
      `Approved source: ${source?.name ?? "any"} (${source?.sourceType ?? "search"})`,
      `User-provided target description: ${run.query ?? ""}`,
      `Structured criteria: ${JSON.stringify(criteria)}`,
      ...buildResearchFragment(reConfig),
      ...buildSoftwareResearchFragment(swConfig),
      `Return up to ${maxResults} realistic candidate companies matching the criteria, each with a contact name, title, email, phone, website, industry, location and a short reason they are a good fit.`,
      `For real estate leads also include propertyInterest, budget, linkedin and sourcePlatform.`,
      `For software leads also include website analysis (outdated UI, mobile, dashboard, performance, automation, inventory, appointment, ERP gaps) and LinkedIn.`,
    ].join("\n");

    const ai = await generateText({
      moduleKey: "company_research",
      tenantId,
      prompt,
      systemPrompt:
        'You discover B2B leads. Respond with ONLY JSON: {"candidates":[{"name":string,"title":string,"company":string,"email":string,"phone":string,"website":string,"industry":string,"location":string,"reason":string,"propertyInterest":string,"budget":string,"linkedin":string,"sourcePlatform":string}]}',
      maxTokens: 2000,
      temperature: 0.5,
    });

    let candidates: any[] = [];
    try {
      const parsed = JSON.parse(ai.text);
      if (Array.isArray(parsed?.candidates)) candidates = parsed.candidates;
    } catch {
      const m = ai.text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed?.candidates)) candidates = parsed.candidates;
        } catch {
          /* leave empty */
        }
      }
    }

    // De-dup by email/phone against existing tenant leads
    const existing = await prisma.lead.findMany({
      where: { tenantId },
      select: { email: true, phone: true },
    });
    const existingEmails = new Set(existing.map((l) => (l.email || "").toLowerCase()).filter(Boolean));
    const existingPhones = new Set(existing.map((l) => (l.phone || "").replace(/\D/g, "")).filter(Boolean));

    let createdCount = 0;
    const createdLeadIds: string[] = [];

    for (const c of candidates) {
      if (!c?.name || !c?.company) continue;
      const email = c.email || slugEmail(c.name, c.company);
      if (email && existingEmails.has(email.toLowerCase())) continue;
      const phoneDigits = (c.phone || "").replace(/\D/g, "");
      if (phoneDigits && existingPhones.has(phoneDigits)) continue;

      const requirement = [
        c.reason ? String(c.reason).slice(0, 250) : "",
        c.propertyInterest ? `Property interest: ${String(c.propertyInterest).slice(0, 100)}` : "",
        c.budget ? `Budget: ${String(c.budget).slice(0, 80)}` : "",
        c.linkedin ? `LinkedIn: ${String(c.linkedin).slice(0, 150)}` : "",
        c.websiteAnalysis ? `Website: ${String(c.websiteAnalysis).slice(0, 150)}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500) || null;

      const lead = await prisma.lead.create({
        data: {
          tenantId,
          name: String(c.name).slice(0, 200),
          email: email?.slice(0, 255) || null,
          phone: c.phone ? String(c.phone).slice(0, 50) : null,
          company: c.title ? `${String(c.company).slice(0, 180)} (${String(c.title).slice(0, 40)})` : String(c.company).slice(0, 200),
          website: c.website ? String(c.website).slice(0, 500) : null,
          industry: c.industry ? String(c.industry).slice(0, 100) : profile?.industry ?? null,
          location: c.location ? String(c.location).slice(0, 200) : null,
          requirement,
          status: "new",
          score: 0,
          consentMarketing: false,
          controlMode: "ai",
        },
      });

      await prisma.leadSource.create({
        data: {
          tenantId,
          leadId: lead.id,
          sourceType: "research",
          externalId: runId,
          attribution: JSON.stringify({
            researchRunId: runId,
            sourceId: run.sourceId,
            sourceName: source?.name ?? null,
            sourcePlatform: c.sourcePlatform ?? source?.name ?? null,
            reason: c.reason ?? null,
            propertyInterest: c.propertyInterest ?? null,
            budget: c.budget ?? null,
            linkedin: c.linkedin ?? null,
            websiteAnalysis: c.websiteAnalysis ?? null,
            confidence: c.sourceConfidence ?? null,
            mock: ai.mock,
          }),
        },
      });

      await recordLeadActivity({
        tenantId,
        leadId: lead.id,
        actorId: opts.actorId ?? null,
        activityType: "lead_created",
        payload: { source: "research", runId, mock: ai.mock },
      });

      existingEmails.add(email.toLowerCase());
      createdLeadIds.push(lead.id);
      createdCount++;
    }

    await prisma.researchRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        results: candidates as unknown as Prisma.InputJsonValue,
        foundCount: candidates.length,
        createdCount,
        completedAt: new Date(),
      },
    });

    await recordAudit({
      tenantId,
      actorId: opts.actorId ?? null,
      actorType: "ai",
      action: "research.completed",
      category: "research",
      targetType: "research_run",
      targetId: runId,
      metadata: { found: candidates.length, created: createdCount, leadIds: createdLeadIds, mock: ai.mock },
    });

    return { runId, status: "completed", foundCount: candidates.length, createdCount };
  } catch (err) {
    const e = err as Error;
    console.error("[research] FAILED:", e.stack || e.message);
    const msg = e.message;
    await prisma.researchRun.update({
      where: { id: runId },
      data: { status: "failed", error: msg.slice(0, 2000), completedAt: new Date() },
    });
    await recordAudit({
      tenantId,
      actorId: opts.actorId ?? null,
      actorType: "ai",
      action: "research.failed",
      category: "research",
      targetType: "research_run",
      targetId: runId,
      metadata: { error: msg.slice(0, 500) },
    });
    return { runId, status: "failed", foundCount: 0, createdCount: 0, error: msg };
  }
}

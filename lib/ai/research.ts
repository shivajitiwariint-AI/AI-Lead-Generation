import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai-gateway";
import { recordAudit, recordLeadActivity } from "@/lib/activity";
import { loadOffers } from "@/lib/ai/matching";
import { getRealEstateConfig, buildResearchFragment } from "@/lib/ai/real-estate";
import { getSoftwareConfig, buildResearchFragment as buildSoftwareResearchFragment } from "@/lib/ai/software-outreach";
import { discoverRealCandidates } from "@/lib/ai/discovery";
import { verifyEmail } from "@/lib/ai/email-verifier";
import { verifyPhone } from "@/lib/ai/phone-verifier";
import { rankCandidates, type QualityConfig } from "@/lib/ai/lead-quality";
import { resolveDataSource } from "@/lib/data-sources";
import type { Prisma } from "@prisma/client";

function normalizeDomain(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(value).toLowerCase().replace(/^www\./i, "").split("/")[0] || null;
  }
}

/**
 * Requirement 4: online research using approved sources.
 * executeResearchRun() is shared by the research API and the orchestrator.
 */

export interface RunResearchOptions {
  tenantId: string;
  runId: string;
  actorId?: string | null;
}

export async function executeResearchRun(opts: RunResearchOptions): Promise<{
  runId: string;
  status: string;
  foundCount: number;
  createdCount: number;
  error?: string;
  liveErrors?: string[];
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
    // Minimum relevance gate: only genuinely relevant businesses become leads.
    const minRelevance = Math.min(Math.max(Number(criteria.minRelevance) || 20, 0), 100);
    const qualityConfig: QualityConfig = {
      industry: criteria.industry ?? profile?.industry ?? null,
      keywords: criteria.keywords ?? null,
      location: criteria.location ?? null,
      offers,
      websiteReachable: false,
    };
    let candidates: any[] = [];
    let liveSources: string[] = [];
    let liveErrors: string[] = [];
    let usedLive = false;
    let mock = false;

    // Prefer real data from configured official APIs. AI generation is only a
    // fallback when no live source returned candidates for this query.
    const placesKey = await resolveDataSource("google_places", tenantId).catch(() => null);
    if (placesKey?.secret || swConfig.enabled) {
      try {
        const live = await discoverRealCandidates({
          tenantId,
          query: run.query ?? "",
          location: criteria.location ?? null,
          industry: criteria.industry ?? profile?.industry ?? null,
          maxResults,
        });
        liveErrors = live.errors;
        if (live.candidates.length > 0) {
          candidates = live.candidates;
          liveSources = live.sources;
          usedLive = true;
        }
      } catch (e: any) {
        liveErrors.push(e.message);
      }
    }

    if (!usedLive) {
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
      mock = ai.mock;

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
    }

    // De-dup by email, phone, website or company against existing tenant leads.
    const existing = await prisma.lead.findMany({
      where: { tenantId },
      select: { email: true, phone: true, website: true, company: true },
    });
    const existingEmails = new Set(existing.map((l) => (l.email || "").toLowerCase()).filter(Boolean));
    const existingPhones = new Set(existing.map((l) => (l.phone || "").replace(/\D/g, "")).filter(Boolean));
    const existingWebsites = new Set(existing.map((l) => normalizeDomain(l.website)).filter(Boolean));
    const existingCompanies = new Set(
      existing.map((l) => String(l.company || "").toLowerCase().replace(/\s*\([^)]*\)$/, "").trim()).filter(Boolean)
    );

    // ---- PASS 1: verify + dedupe + website status (data quality gate) ----
    type Prepared = {
      c: any;
      email: string | null;
      phoneValue: string | null;
      emailVerified: boolean;
      phoneVerified: boolean;
      domain: string | null;
      companyKey: string;
    };
    const prepared: Prepared[] = [];

    for (const c of candidates) {
      if (!c?.name || !c?.company) continue;

      // --- Email verification (domain exists, not disposable, deliverable) ---
      const email = c.email ? String(c.email).slice(0, 255) : null;
      let emailVerified = false;
      if (email) {
        if (existingEmails.has(email.toLowerCase())) continue;
        const emailResult = await verifyEmail(email, tenantId);
        if (!emailResult.valid) continue; // skip disposable / undeliverable
        emailVerified = Boolean(emailResult.deliverable) || emailResult.confidence >= 0.6;
      }

      // --- Phone verification (format + reachable where supported) ---
      let phoneVerified = false;
      let phoneValue: string | null = null;
      if (c.phone) {
        const phoneDigits = String(c.phone).replace(/\D/g, "");
        if (phoneDigits && existingPhones.has(phoneDigits)) continue;
        const phoneResult = await verifyPhone(String(c.phone), tenantId);
        if (!phoneResult.valid) continue;
        phoneValue = phoneResult.e164 ?? String(c.phone).slice(0, 50);
        phoneVerified = phoneResult.verified;
      }

      // --- Website status check ---
      let websiteReachable = false;
      const domain = normalizeDomain(c.website);
      if (c.website) {
        try {
          const res = await fetch(/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website}`, {
            method: "HEAD",
            signal: AbortSignal.timeout(6000),
            redirect: "follow",
          });
          websiteReachable = res.ok;
        } catch {
          websiteReachable = false;
        }
      }

      // --- Duplicate removal against current batch + existing leads ---
      if (domain && existingWebsites.has(domain)) continue;
      const companyKey = String(c.company).toLowerCase().trim();
      if (existingCompanies.has(companyKey)) continue;

      prepared.push({
        c: { ...c, emailVerified, phoneVerified, websiteSignals: c.websiteSignals ?? [] },
        email,
        phoneValue,
        emailVerified,
        phoneVerified,
        domain,
        companyKey,
      });
      // Mark so the rest of this batch is also de-duplicated against it.
      if (email) existingEmails.add(email.toLowerCase());
      if (phoneValue) existingPhones.add(phoneValue.replace(/\D/g, ""));
      if (domain) existingWebsites.add(domain);
      existingCompanies.add(companyKey);
      qualityConfig.websiteReachable = qualityConfig.websiteReachable || websiteReachable;
    }

    // ---- PASS 2: rank by relevance then quality; keep only the best ----
    const ranked = rankCandidates(prepared.map((p) => p.c), qualityConfig, {
      minRelevance,
      limit: maxResults,
    });

    let createdCount = 0;
    const createdLeadIds: string[] = [];

    for (const rankedItem of ranked) {
      const c = rankedItem;
      const p = prepared.find((x) => x.c === c || x.c.company === c.company && x.c.name === c.name);
      const email = p?.email ?? (c.email ? String(c.email).slice(0, 255) : null);
      const phoneValue = p?.phoneValue ?? null;
      const emailVerified = p?.emailVerified ?? false;
      const phoneVerified = p?.phoneVerified ?? false;
      const domain = p?.domain ?? normalizeDomain(c.website);
      const companyKey = p?.companyKey ?? String(c.company).toLowerCase().trim();

      const requirement = [
        c.reason ? String(c.reason).slice(0, 250) : "",
        c.propertyInterest ? `Property interest: ${String(c.propertyInterest).slice(0, 100)}` : "",
        c.budget ? `Budget: ${String(c.budget).slice(0, 80)}` : "",
        c.linkedin ? `LinkedIn: ${String(c.linkedin).slice(0, 150)}` : "",
        c.websiteAnalysis ? `Website: ${String(c.websiteAnalysis).slice(0, 150)}` : "",
        c.sourceUrl ? `Source: ${String(c.sourceUrl).slice(0, 150)}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500) || null;

      const lead = await prisma.lead.create({
        data: {
          tenantId,
          name: String(c.name).slice(0, 200),
          email: email || null,
          phone: phoneValue,
          company: c.title ? `${String(c.company).slice(0, 180)} (${String(c.title).slice(0, 40)})` : String(c.company).slice(0, 200),
          website: c.website ? String(c.website).slice(0, 500) : null,
          industry: c.industry ? String(c.industry).slice(0, 100) : profile?.industry ?? null,
          location: c.location ? String(c.location).slice(0, 200) : null,
          requirement,
          status: "new",
          score: 0,
          consentMarketing: false,
          verified: false,
          emailVerified,
          phoneVerified,
          relevanceScore: c.quality.relevanceScore,
          dataQualityScore: c.quality.dataQualityScore,
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
            websiteSignals: c.websiteSignals ?? null,
            performanceScore: c.performanceScore ?? null,
            sourceUrl: c.sourceUrl ?? null,
            externalId: c.externalId ?? null,
            discoveredAt: new Date().toISOString(),
            // External discoveries stay unverified until a human checks them.
            verified: false,
            confidence: c.confidence ?? c.sourceConfidence ?? null,
            live: usedLive,
            mock,
            relevanceScore: c.quality.relevanceScore,
            dataQualityScore: c.quality.dataQualityScore,
            qualityReasons: c.quality.reasons,
            emailVerified,
            phoneVerified,
          }),
        },
      });

      await recordLeadActivity({
        tenantId,
        leadId: lead.id,
        actorId: opts.actorId ?? null,
        activityType: "lead_created",
        payload: {
          source: "research", runId, mock, live: usedLive,
          relevanceScore: c.quality.relevanceScore,
          dataQualityScore: c.quality.dataQualityScore,
        },
      });

      createdLeadIds.push(lead.id);
      createdCount++;
    }

    await prisma.researchRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        results: ranked as unknown as Prisma.InputJsonValue,
        foundCount: candidates.length,
        createdCount,
        completedAt: new Date(),
        // Surface live-source failures so the UI can explain why no leads were
        // created (e.g. Google Places API not enabled) instead of a bare 0.
        error:
          createdCount === 0 && liveErrors.length
            ? liveErrors.join(" · ")
            : null,
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
      metadata: {
        found: candidates.length,
        qualified: ranked.length,
        created: createdCount,
        leadIds: createdLeadIds,
        minRelevance,
        mock,
        live: usedLive,
        liveSources,
        liveErrors,
      },
    });

    return { runId, status: "completed", foundCount: candidates.length, createdCount, liveErrors };
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

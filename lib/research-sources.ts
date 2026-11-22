import { prisma } from "@/lib/prisma";

/**
 * Platforms that have no public API for this use are added as manually
 * approved research sources. They are metadata only — the platform never
 * scrapes them or automates any account activity.
 */
export const MANUAL_RESEARCH_SOURCES = [
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/",
    notes: "Manually review public company and people profiles. No scraping, browser automation or automated messaging.",
  },
  {
    name: "Justdial",
    url: "https://www.justdial.com/",
    notes: "Manually review public business listings. No automated collection.",
  },
  {
    name: "IndiaMART",
    url: "https://www.indiamart.com/",
    notes: "Manually review public supplier listings. No automated collection.",
  },
  {
    name: "TradeIndia",
    url: "https://www.tradeindia.com/",
    notes: "Manually review public supplier listings. No automated collection.",
  },
] as const;

const MANUAL_CONFIG = {
  manual: true,
  scrape: false,
  apiKeyRequired: false,
} as const;

/** Idempotently make the four manual sources available to a company. */
export async function ensureManualResearchSources(tenantId: string): Promise<string[]> {
  const added: string[] = [];

  for (const source of MANUAL_RESEARCH_SOURCES) {
    const config = {
      ...MANUAL_CONFIG,
      notes: source.notes,
    };
    const existing = await prisma.researchSource.findFirst({
      where: { tenantId, name: source.name },
      select: { id: true, approved: true, sourceType: true, url: true, config: true },
    });

    if (existing) {
      const existingConfig = (existing.config ?? {}) as Record<string, unknown>;
      const needsUpdate =
        !existing.approved ||
        existing.sourceType !== "manual" ||
        existing.url !== source.url ||
        existingConfig.scrape !== false;
      if (needsUpdate) {
        await prisma.researchSource.update({
          where: { id: existing.id },
          data: {
            approved: true,
            sourceType: "manual",
            url: source.url,
            config: config as any,
          },
        });
      }
      continue;
    }

    await prisma.researchSource.create({
      data: {
        tenantId,
        name: source.name,
        sourceType: "manual",
        url: source.url,
        approved: true,
        config: config as any,
      },
    });
    added.push(source.name);
  }

  return added;
}

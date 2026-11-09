import { prisma } from "@/lib/prisma";

export interface CountrySchedule {
  country: string;
  enabled: boolean;
  everyHours: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  dueNow: boolean;
  lastCreatedCount: number | null;
}

export const DEFAULT_EVERY_HOURS = 24;
export const MIN_EVERY_HOURS = 1;
export const MAX_EVERY_HOURS = 720; // 30 days

const PRESETS = [1, 6, 12, 24, 48, 168, 720];

export function isValidEveryHours(n: number) {
  return Number.isFinite(n) && n >= MIN_EVERY_HOURS && n <= MAX_EVERY_HOURS;
}

function parseFrequencies(targetMarket: any): Record<string, { enabled: boolean; everyHours: number }> {
  const raw = (targetMarket as any)?.searchFrequencies ?? {};
  const out: Record<string, { enabled: boolean; everyHours: number }> = {};
  if (raw && typeof raw === "object") {
    for (const [country, v] of Object.entries(raw)) {
      const obj = (v as any) ?? {};
      const everyHours = Number(obj.everyHours ?? DEFAULT_EVERY_HOURS);
      out[country] = {
        enabled: obj.enabled === undefined ? true : !!obj.enabled,
        everyHours: isValidEveryHours(everyHours) ? everyHours : DEFAULT_EVERY_HOURS,
      };
    }
  }
  return out;
}

export async function getSchedules(tenantId: string): Promise<{
  countries: string[];
  schedules: CountrySchedule[];
  targetMarket: any;
}> {
  const profile = await prisma.companyProfile.findUnique({ where: { tenantId } });
  const targetMarket = (profile?.targetMarket ?? {}) as Record<string, any>;
  const locations: string[] = Array.isArray(targetMarket.locations)
    ? targetMarket.locations.filter((x: any) => typeof x === "string" && x.trim())
    : [];
  const freqs = parseFrequencies(targetMarket);

  // Last run per country: newest ResearchRun whose criteria.location matches the country
  const runs = await prisma.researchRun.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const now = Date.now();
  const schedules: CountrySchedule[] = locations.map((country) => {
    const cfg = freqs[country] ?? { enabled: true, everyHours: DEFAULT_EVERY_HOURS };
    const last = runs.find((r) => {
      const loc = (r.criteria as any)?.location;
      if (typeof loc !== "string") return false;
      const needle = country.toLowerCase();
      const hay = loc.toLowerCase();
      return hay === needle || hay.split(",").map((s) => s.trim()).includes(needle);
    });
    const lastRunAt = last ? ((last.completedAt ?? last.createdAt)?.toISOString() ?? null) : null;
    const nextRunAt = lastRunAt
      ? new Date(new Date(lastRunAt).getTime() + cfg.everyHours * 3600000).toISOString()
      : null;
    const dueNow =
      cfg.enabled && (lastRunAt == null || now >= new Date(nextRunAt as string).getTime());
    return {
      country,
      enabled: cfg.enabled,
      everyHours: cfg.everyHours,
      lastRunAt,
      nextRunAt,
      dueNow,
      lastCreatedCount: last?.createdCount ?? null,
    };
  });

  return { countries: locations, schedules, targetMarket };
}

export async function setSchedules(
  tenantId: string,
  input: Array<{ country: string; enabled: boolean; everyHours: number }>
) {
  const profile = await prisma.companyProfile.findUnique({ where: { tenantId } });
  const targetMarket = ((profile?.targetMarket ?? {}) as Record<string, any>) ?? {};

  const existingLocations: string[] = Array.isArray(targetMarket.locations)
    ? targetMarket.locations.filter((x: any) => typeof x === "string" && x.trim())
    : [];
  const seen = new Set(existingLocations);
  const searchFrequencies: Record<string, { enabled: boolean; everyHours: number }> = {};

  for (const item of input) {
    const country = String(item.country ?? "").trim();
    if (!country) continue;
    if (!isValidEveryHours(item.everyHours)) {
      throw new Error(`Invalid frequency for ${country}`);
    }
    if (!seen.has(country)) seen.add(country);
    searchFrequencies[country] = {
      enabled: !!item.enabled,
      everyHours: item.everyHours,
    };
  }

  // Keep countries that were in the profile but not sent, with defaults, so nothing is lost
  for (const c of existingLocations) {
    if (!searchFrequencies[c]) {
      searchFrequencies[c] = { enabled: true, everyHours: DEFAULT_EVERY_HOURS };
    }
  }

  const nextTarget = {
    ...targetMarket,
    locations: Array.from(seen),
    searchFrequencies,
  };

  return prisma.companyProfile.upsert({
    where: { tenantId },
    create: { tenantId, targetMarket: nextTarget as any },
    update: { targetMarket: nextTarget as any },
  });
}

export function formatEveryHours(hours: number) {
  if (hours === 1) return "every 1 hour";
  if (hours < 24) return `every ${hours} hours`;
  if (hours === 24) return "daily";
  if (hours === 48) return "every 2 days";
  if (hours === 168) return "weekly";
  if (hours === 720) return "monthly";
  if (hours % 24 === 0) return `every ${hours / 24} days`;
  return `every ${hours} hours`;
}

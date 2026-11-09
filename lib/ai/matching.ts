import { prisma } from "@/lib/prisma";

/**
 * Requirement 5: match a lead against the company's offer catalog
 * (CompanyProfile.products / services / properties).
 * Deterministic keyword scoring — runs alongside the AI qualification so
 * matches remain explainable even when a local model fallback is used.
 */

export interface OfferDefinition {
  name: string;
  offerType: "product" | "service" | "property";
  description?: string;
  keywords?: string[];
}

export interface OfferMatch {
  offer: string;
  offerType: "product" | "service" | "property";
  score: number;
  reason: string;
}

interface LeadSignals {
  requirement?: string | null;
  industry?: string | null;
  company?: string | null;
  location?: string | null;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "are", "our", "your", "you",
  "have", "has", "need", "want", "looking", "from", "into", "get", "can",
  "how", "what", "when", "who", "why", "not", "but", "any", "some", "more",
]);

export function loadOffers(profile: {
  products?: unknown;
  services?: unknown;
  properties?: unknown;
} | null): OfferDefinition[] {
  if (!profile) return [];
  const offers: OfferDefinition[] = [];

  const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
  for (const p of arr(profile.products)) {
    if (!p?.name) continue;
    offers.push({
      name: String(p.name),
      offerType: "product",
      description: p.description ? String(p.description) : undefined,
      keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : [],
    });
  }
  for (const s of arr(profile.services)) {
    if (!s?.name) continue;
    offers.push({
      name: String(s.name),
      offerType: "service",
      description: s.description ? String(s.description) : undefined,
      keywords: Array.isArray(s.keywords) ? s.keywords.map(String) : [],
    });
  }
  // "properties" (e.g. property listings for real-estate operators)
  for (const pr of arr(profile.properties)) {
    const name = pr?.name ?? pr?.value ?? pr?.key;
    if (!name || pr?.isMeta === true) continue;
    offers.push({
      name: String(name),
      offerType: "property",
      description: pr?.description ? String(pr.description) : undefined,
      keywords: Array.isArray(pr?.keywords) ? pr.keywords.map(String) : [],
    });
  }
  return offers;
}

export function matchOffers(
  signals: LeadSignals,
  offers: OfferDefinition[]
): { matchScore: number; matches: OfferMatch[] } {
  const leadText = [signals.requirement, signals.industry, signals.company, signals.location]
    .filter(Boolean)
    .join(" ");
  const leadTokens = Array.from(tokenize(leadText)).filter((t) => !STOPWORDS.has(t));
  const leadSet = new Set(leadTokens);

  const industry = (signals.industry || "").toLowerCase();

  const matches: OfferMatch[] = offers.map((offer) => {
    const offerTokens = Array.from(tokenize(offer.name)).concat(
      (offer.keywords ?? []).flatMap((k) => Array.from(tokenize(k))),
      offer.description ? Array.from(tokenize(offer.description)) : []
    ).filter((t) => !STOPWORDS.has(t));

    const unique = Array.from(new Set(offerTokens));
    const overlap = unique.filter((t) => leadSet.has(t));
    const overlapRatio = unique.length ? overlap.length / unique.length : 0;

    let score = Math.min(100, Math.round(overlapRatio * 130));
    const industryHit =
      industry &&
      (unique.some((t) => industry.includes(t)) ||
        tokenize(offer.name + " " + (offer.description ?? "")).has(industry));
    if (industryHit) score = Math.min(100, score + 15);
    if (overlap.length >= 3) score = Math.min(100, score + 10);

    const reason =
      overlap.length > 0
        ? `Lead mentions ${overlap.slice(0, 5).join(", ")} which maps to this ${offer.offerType}.`
        : industryHit
          ? `Lead industry (${signals.industry}) aligns with this ${offer.offerType}.`
          : `General ${offer.offerType} availability — no strong keyword signal.`;

    return { offer: offer.name, offerType: offer.offerType, score, reason };
  });

  matches.sort((a, b) => b.score - a.score);
  const strong = matches.filter((m) => m.score >= 30).slice(0, 5);
  const matchScore = matches.length ? matches[0].score : 0;

  return { matchScore, matches: strong };
}

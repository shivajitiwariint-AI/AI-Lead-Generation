import type { OfferDefinition } from "@/lib/ai/matching";

/**
 * Quality-first lead generation.
 * The goal is NOT to collect 1,000 email addresses — it is to find 100
 * businesses that are genuinely relevant to the customer's services.
 *
 * Two scores are computed before a lead is ever created:
 *  - relevanceScore: how well the candidate matches the customer's offers,
 *    industry, and keywords (i.e. genuine relevance/buying intent).
 *  - dataQualityScore: how complete and verifiable the contact data is.
 */

export interface QualityCandidate {
  name?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  reason?: string | null;
  linkedin?: string | null;
  sourceUrl?: string | null;
  websiteSignals?: string[] | null;
  // Filled by the verifiers in the research pipeline.
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export interface QualityConfig {
  industry?: string | null;
  keywords?: string | null;
  location?: string | null;
  offers?: OfferDefinition[];
  websiteReachable?: boolean;
}

export interface QualityScore {
  relevanceScore: number;
  dataQualityScore: number;
  overall: number;
  reasons: string[];
  shouldCreate: boolean;
}

const INTENT_TERMS = [
  "looking for", "need", "urgent", "asap", "budget", "quote", "pricing",
  "implement", "replace", "upgrade", "buying", "hire", "shortlist", "evaluate",
];

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  Array.from(a).forEach((t) => { if (b.has(t)) n++; });
  return n;
}

/** 0-100 score of how relevant the candidate is to the customer's services. */
function scoreRelevance(c: QualityCandidate, cfg: QualityConfig): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const haystack = tokenize(
    [c.company, c.reason, c.industry, c.website, c.linkedin].filter(Boolean).join(" ")
  );

  // Offer / keyword match is the strongest signal of genuine relevance.
  const offerTokens = new Set<string>();
  (cfg.offers ?? []).forEach((o) => {
    tokenize([o.name, o.description, (o.keywords ?? []).join(" ")].join(" "))
      .forEach((t) => offerTokens.add(t));
  });
  const keywordTokens = tokenize(cfg.keywords ?? "");
  const matchTokens = new Set(Array.from(offerTokens).concat(Array.from(keywordTokens)));
  if (matchTokens.size) {
    const hits = overlap(haystack, matchTokens);
    if (hits > 0) {
      const boost = Math.min(45, hits * 15);
      score += boost;
      reasons.push(`matches ${hits} offer/keyword term(s)`);
    }
  }

  // Industry match.
  if (cfg.industry && c.industry) {
    if (c.industry.toLowerCase().includes(cfg.industry.toLowerCase()) ||
        cfg.industry.toLowerCase().includes(c.industry.toLowerCase())) {
      score += 20;
      reasons.push("industry matches target");
    }
  }

  // Location match.
  if (cfg.location && c.location) {
    if (c.location.toLowerCase().includes(cfg.location.toLowerCase())) {
      score += 10;
      reasons.push("location matches target");
    }
  }

  // Buying intent phrases in the discovery reason.
  const reasonText = (c.reason ?? "").toLowerCase();
  const intentHits = INTENT_TERMS.filter((t) => reasonText.includes(t));
  if (intentHits.length) {
    score += Math.min(15, intentHits.length * 8);
    reasons.push(`buying-intent signal: ${intentHits.slice(0, 2).join(", ")}`);
  }

  // A reachable website with diagnosed gaps is a real business with a need.
  if (c.website && cfg.websiteReachable) {
    score += 5;
    reasons.push("website reachable");
  }
  if (c.websiteSignals && c.websiteSignals.length) {
    score += 5;
    reasons.push("website gaps detected (service need)");
  }

  return { score: Math.min(100, score), reasons };
}

/** 0-100 score of how complete and verifiable the contact data is. */
function scoreDataQuality(c: QualityCandidate, cfg: QualityConfig): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (c.email) {
    score += c.emailVerified ? 30 : 12;
    reasons.push(c.emailVerified ? "email verified" : "email present (unverified)");
  }
  if (c.phone) {
    score += c.phoneVerified ? 20 : 8;
    reasons.push(c.phoneVerified ? "phone verified" : "phone present (unverified)");
  }
  if (c.company) { score += 10; reasons.push("company present"); }
  if (c.website) { score += 10; reasons.push("website present"); }
  if (c.linkedin) { score += 10; reasons.push("LinkedIn present"); }
  if (c.location) { score += 10; reasons.push("location present"); }
  if (cfg.websiteReachable) { score += 10; reasons.push("site reachable"); }

  return { score: Math.min(100, score), reasons };
}

/**
 * Score and gate a candidate. Only candidates with genuine relevance pass.
 * A minimum relevance threshold is what keeps the pipeline focused on quality.
 */
export function scoreCandidate(
  c: QualityCandidate,
  cfg: QualityConfig,
  minRelevance = 20
): QualityScore {
  const relevance = scoreRelevance(c, cfg);
  const quality = scoreDataQuality(c, cfg);
  const overall = Math.round(relevance.score * 0.6 + quality.score * 0.4);
  return {
    relevanceScore: relevance.score,
    dataQualityScore: quality.score,
    overall,
    reasons: [...relevance.reasons, ...quality.reasons],
    shouldCreate: relevance.score >= minRelevance,
  };
}

/**
 * Rank candidates by relevance first, then data quality. Returns only the top
 * `limit` candidates that clear the minimum relevance threshold.
 */
export function rankCandidates<T extends QualityCandidate>(
  candidates: T[],
  cfg: QualityConfig,
  options: { minRelevance?: number; limit?: number } = {}
): Array<T & { quality: QualityScore }> {
  const minRelevance = options.minRelevance ?? 20;
  const limit = options.limit ?? candidates.length;

  return candidates
    .map((c) => ({ ...c, quality: scoreCandidate(c, cfg, minRelevance) }))
    .filter((c) => c.quality.shouldCreate)
    .sort((a, b) => b.quality.overall - a.quality.overall)
    .slice(0, limit);
}

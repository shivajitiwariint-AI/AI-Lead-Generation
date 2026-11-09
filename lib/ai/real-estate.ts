export interface RealEstateConfig {
  enabled: boolean;
  propertyTypes: string[];
  buyerTypes: string[];
  platforms: string[];
  keywords: string[];
  collectFields: string[];
  outreachTone: string;
  outreachMentions: string[];
  outreachRules: string[];
  maxResults: number;
}

export const REAL_ESTATE_DEFAULTS: RealEstateConfig = {
  enabled: false,
  propertyTypes: [
    "flats",
    "apartments",
    "commercial properties",
    "office spaces",
    "plots",
    "real estate investments",
    "rental properties",
  ],
  buyerTypes: [
    "property buyers",
    "investors",
    "working professionals",
    "IT employees",
    "startup founders",
    "doctors",
    "business owners",
    "NRIs",
    "families searching for homes",
    "brokers",
    "real estate agencies",
  ],
  platforms: [
    "Google Maps",
    "LinkedIn",
    "Facebook Marketplace",
    "99acres",
    "MagicBricks",
    "Housing.com",
    "IndiaMART",
    "Justdial",
    "local business directories",
  ],
  keywords: [
    "looking for flats",
    "apartment buyers",
    "office buyers",
    "commercial property investors",
    "real estate investment",
    "property dealers",
    "startup office space",
    "companies expanding office",
  ],
  collectFields: [
    "full name",
    "company name",
    "job title",
    "phone number",
    "email",
    "LinkedIn profile",
    "city/location",
    "property interest",
    "budget range",
    "source platform",
  ],
  outreachTone: "professional, short, human-like, non-spammy",
  outreachMentions: [
    "available flats",
    "investment opportunities",
    "premium locations",
    "ready-to-move properties",
    "commercial office spaces",
    "site visits",
    "pricing benefits",
  ],
  outreachRules: [
    "no aggressive marketing",
    "no bulk spam",
    "no duplicate messages",
  ],
  maxResults: 5,
};

function asStringArray(v: any, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out = v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  return out.length ? out : fallback;
}

export function getRealEstateConfig(profile: any): RealEstateConfig {
  const target = (profile?.targetMarket ?? {}) as Record<string, any>;
  const raw = (target.realEstate ?? {}) as Record<string, any>;
  const industry = String(profile?.industry ?? "").toLowerCase();
  const autoEnabled = industry.includes("real") && industry.includes("estate");

  if (!Object.keys(raw).length) {
    return { ...REAL_ESTATE_DEFAULTS, enabled: autoEnabled };
  }
  return {
    enabled: raw.enabled === undefined ? autoEnabled : !!raw.enabled,
    propertyTypes: asStringArray(raw.propertyTypes, REAL_ESTATE_DEFAULTS.propertyTypes),
    buyerTypes: asStringArray(raw.buyerTypes, REAL_ESTATE_DEFAULTS.buyerTypes),
    platforms: asStringArray(raw.platforms, REAL_ESTATE_DEFAULTS.platforms),
    keywords: asStringArray(raw.keywords, REAL_ESTATE_DEFAULTS.keywords),
    collectFields: asStringArray(raw.collectFields, REAL_ESTATE_DEFAULTS.collectFields),
    outreachTone: typeof raw.outreachTone === "string" && raw.outreachTone.trim() ? raw.outreachTone.trim() : REAL_ESTATE_DEFAULTS.outreachTone,
    outreachMentions: asStringArray(raw.outreachMentions, REAL_ESTATE_DEFAULTS.outreachMentions),
    outreachRules: asStringArray(raw.outreachRules, REAL_ESTATE_DEFAULTS.outreachRules),
    maxResults: Math.min(20, Math.max(1, Number(raw.maxResults) || REAL_ESTATE_DEFAULTS.maxResults)),
  };
}

export function buildResearchFragment(cfg: RealEstateConfig): string[] {
  if (!cfg.enabled) return [];
  return [
    `Real estate focus property types: ${cfg.propertyTypes.join(", ")}.`,
    `Target buyer types: ${cfg.buyerTypes.join(", ")}.`,
    `Search these platforms: ${cfg.platforms.join(", ")}.`,
    `Search keywords: ${cfg.keywords.join("; ")}.`,
    `For each candidate, collect: ${cfg.collectFields.join(", ")}.`,
    `Return propertyInterest, budget, linkedin and sourcePlatform for each candidate.`,
  ];
}

export function buildQualificationFragment(cfg: RealEstateConfig): string[] {
  if (!cfg.enabled) return [];
  return [
    `Real estate scoring: HIGH if active investor, business owner, high-income professional, or actively searching properties.`,
    `MEDIUM if potential future buyer, moderate budget, or indirect interest.`,
    `LOW if incomplete contact info, low intent, or inactive profile.`,
    `Consider profession, income potential, business activity, investment capability, property requirements, social presence, company growth.`,
    `Identify likely buyers, investment intent, relocation needs, commercial property needs.`,
  ];
}

export function buildOutreachFragment(cfg: RealEstateConfig): string[] {
  if (!cfg.enabled) return [];
  return [
    `Real estate outreach tone: ${cfg.outreachTone}.`,
    `Mention (where relevant): ${cfg.outreachMentions.join(", ")}.`,
    `Rules: ${cfg.outreachRules.join(", ")}.`,
    `Personalize with the lead's property interest and budget. Offer site visits and pricing benefits.`,
  ];
}

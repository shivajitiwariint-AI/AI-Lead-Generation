export interface SoftwareOutreachConfig {
  enabled: boolean;
  services: string[];
  targetBusinesses: string[];
  platforms: string[];
  collectFields: string[];
  websiteSignals: string[];
  outreachMentions: string[];
  outreachTone: string;
  maxResults: number;
}

export const SOFTWARE_DEFAULTS: SoftwareOutreachConfig = {
  enabled: false,
  services: [
    "website development",
    "admin dashboards",
    "ERP software",
    "inventory systems",
    "automation",
    "cloud deployment",
    "business management software",
  ],
  targetBusinesses: [
    "schools",
    "coaching institutes",
    "clinics",
    "wholesalers",
    "distributors",
    "factories",
    "CA firms",
    "local businesses",
    "startups",
  ],
  platforms: ["Google Maps", "IndiaMART", "Justdial", "LinkedIn", "TradeIndia", "business directories"],
  collectFields: ["business name", "website", "owner/contact name", "email", "phone number", "LinkedIn profile", "location"],
  websiteSignals: [
    "outdated UI",
    "no mobile responsiveness",
    "missing dashboard/admin features",
    "poor performance",
    "no automation",
    "no online management system",
    "no inventory tracking",
    "no appointment system",
    "no ERP functionality",
  ],
  outreachMentions: [
    "website modernization",
    "dashboard systems",
    "inventory management",
    "ERP systems",
    "cloud deployment",
    "automation services",
  ],
  outreachTone: "professional, short, human-like, non-spammy",
  maxResults: 5,
};

function asArray(v: any, fb: string[]) {
  if (!Array.isArray(v)) return fb;
  const o = v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  return o.length ? o : fb;
}

export function getSoftwareConfig(profile: any): SoftwareOutreachConfig {
  const target = (profile?.targetMarket ?? {}) as Record<string, any>;
  const raw = (target.software ?? {}) as Record<string, any>;
  const industry = String(profile?.industry ?? "").toLowerCase();
  const auto = industry.includes("software") || industry.includes("it") || industry.includes("agency");
  if (!Object.keys(raw).length) return { ...SOFTWARE_DEFAULTS, enabled: auto };
  return {
    enabled: raw.enabled === undefined ? auto : !!raw.enabled,
    services: asArray(raw.services, SOFTWARE_DEFAULTS.services),
    targetBusinesses: asArray(raw.targetBusinesses, SOFTWARE_DEFAULTS.targetBusinesses),
    platforms: asArray(raw.platforms, SOFTWARE_DEFAULTS.platforms),
    collectFields: asArray(raw.collectFields, SOFTWARE_DEFAULTS.collectFields),
    websiteSignals: asArray(raw.websiteSignals, SOFTWARE_DEFAULTS.websiteSignals),
    outreachMentions: asArray(raw.outreachMentions, SOFTWARE_DEFAULTS.outreachMentions),
    outreachTone: typeof raw.outreachTone === "string" && raw.outreachTone.trim() ? raw.outreachTone : SOFTWARE_DEFAULTS.outreachTone,
    maxResults: Math.min(20, Math.max(1, Number(raw.maxResults) || SOFTWARE_DEFAULTS.maxResults)),
  };
}

export function buildResearchFragment(cfg: SoftwareOutreachConfig): string[] {
  if (!cfg.enabled) return [];
  return [
    `Software agency focus services: ${cfg.services.join(", ")}.`,
    `Target businesses: ${cfg.targetBusinesses.join(", ")}.`,
    `Search platforms: ${cfg.platforms.join(", ")}.`,
    `For each candidate, assess website signals: ${cfg.websiteSignals.join(", ")}.`,
    `Collect: ${cfg.collectFields.join(", ")}.`,
  ];
}

export function buildQualificationFragment(cfg: SoftwareOutreachConfig): string[] {
  if (!cfg.enabled) return [];
  return [
    `Software lead scoring: HIGH if outdated website, no digital systems, scaling potential, active operations, visible contact details.`,
    `MEDIUM if partial digital presence or indirect need. LOW if modern systems exist or inactive / no contact info.`,
    `Prioritize detected problems: ${cfg.websiteSignals.join(", ")}.`,
  ];
}

export function buildOutreachFragment(cfg: SoftwareOutreachConfig): string[] {
  if (!cfg.enabled) return [];
  return [
    `Software outreach tone: ${cfg.outreachTone}.`,
    `Offer (where relevant): ${cfg.outreachMentions.join(", ")}.`,
    `Personalize by business type, website quality, and detected business problem.`,
  ];
}

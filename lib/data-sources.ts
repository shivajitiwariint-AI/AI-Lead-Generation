import { prisma } from "@/lib/prisma";
import { decryptSecret, maskSecret } from "@/lib/encryption";

/**
 * Official data sources the platform can call. Anything without a supported
 * public API (LinkedIn, Justdial, IndiaMART, TradeIndia) is deliberately not
 * listed here — those are added automatically as manually approved research
 * sources, but they are never scraped.
 */
export const DATA_SOURCE_PROVIDERS = [
  {
    key: "google_places",
    label: "Google Places (Maps)",
    category: "Discovery",
    description: "Find real local businesses: name, address, phone, website and ratings.",
    secretLabel: "Google Maps Places API key",
    secondaryLabel: null,
    env: "GOOGLE_PLACES_API_KEY",
    secondaryEnv: null,
    docs: "https://developers.google.com/maps/documentation/places/web-service/cloud-setup",
  },
  {
    key: "pagespeed",
    label: "PageSpeed Insights",
    category: "Website checks",
    description: "Mobile performance and usability scores for discovered websites.",
    secretLabel: "Google API key (optional)",
    secondaryLabel: null,
    env: "PAGESPEED_API_KEY",
    secondaryEnv: null,
    docs: "https://developers.google.com/speed/docs/insights/v5/get-started",
  },
  {
    key: "apollo",
    label: "Apollo.io",
    category: "Contact enrichment",
    description: "Find a decision-maker's work email, title and LinkedIn profile.",
    secretLabel: "Apollo API key",
    secondaryLabel: null,
    env: "APOLLO_API_KEY",
    secondaryEnv: null,
    docs: "https://docs.apollo.io/reference/authentication",
  },
  {
    key: "hunter",
    label: "Hunter.io",
    category: "Contact enrichment",
    description: "Verify and discover email addresses for a company domain.",
    secretLabel: "Hunter API key",
    secondaryLabel: null,
    env: "HUNTER_API_KEY",
    secondaryEnv: null,
    docs: "https://hunter.io/api-documentation/v2",
  },
  {
    key: "builtwith",
    label: "BuiltWith",
    category: "Website checks",
    description: "Detect the technologies a website uses to spot outdated stacks.",
    secretLabel: "BuiltWith API key (optional)",
    secondaryLabel: null,
    env: "BUILTWITH_API_KEY",
    secondaryEnv: null,
    docs: "https://api.builtwith.com/documentation/api-guide",
  },
  {
    key: "x",
    label: "X (Twitter) API",
    category: "Intent signals",
    description: "Recent public posts that mention a problem you can solve.",
    secretLabel: "Bearer token",
    secondaryLabel: null,
    env: "X_API_BEARER_TOKEN",
    secondaryEnv: null,
    docs: "https://developer.x.com/en/docs/x-api/getting-started",
  },
  {
    key: "youtube",
    label: "YouTube Data API",
    category: "Intent signals",
    description: "Find channels and videos discussing a relevant business problem.",
    secretLabel: "API key",
    secondaryLabel: null,
    env: "YOUTUBE_API_KEY",
    secondaryEnv: null,
    docs: "https://developers.google.com/youtube/v3/getting-started",
  },
  {
    key: "reddit",
    label: "Reddit API",
    category: "Intent signals",
    description: "Pain-point discovery in public subreddits (not a contact database).",
    secretLabel: "Client ID",
    secondaryLabel: "Client secret",
    env: "REDDIT_CLIENT_ID",
    secondaryEnv: "REDDIT_CLIENT_SECRET",
    docs: "https://www.reddit.com/dev/api/oauth",
  },
  {
    key: "tiktok",
    label: "TikTok Display API",
    category: "Social videos",
    description: "Read short videos from a connected TikTok account (official API only).",
    secretLabel: "User access token",
    secondaryLabel: null,
    env: "TIKTOK_ACCESS_TOKEN",
    secondaryEnv: null,
    docs: "https://developers.tiktok.com/doc/display-api-overview",
  },
  {
    key: "email_verifier",
    label: "Email Verifier (Hunter.io)",
    category: "Contact verification",
    description: "Verify that an email address is deliverable and not disposable.",
    secretLabel: "Hunter.io API key",
    secondaryLabel: null,
    env: "HUNTER_API_KEY",
    secondaryEnv: null,
    docs: "https://hunter.io/api-documentation/v2",
  },
  {
    key: "phone_verifier",
    label: "Phone Verifier",
    category: "Contact verification",
    description: "Validate and format phone numbers in E.164 format.",
    secretLabel: "Phone verification API key (optional)",
    secondaryLabel: null,
    env: "PHONE_VERIFIER_API_KEY",
    secondaryEnv: null,
    docs: "https://example.com/phone-verifier-api",
  },
] as const;

export type DataSourceProviderDefinition = (typeof DATA_SOURCE_PROVIDERS)[number];
export type DataSourceKey = DataSourceProviderDefinition["key"];

export function getDataSourceDefinition(key: string): DataSourceProviderDefinition | null {
  return DATA_SOURCE_PROVIDERS.find((p) => p.key === key) ?? null;
}

export interface ResolvedDataSource {
  secret: string | null;
  secondary: string | null;
  enabled: boolean;
  source: "tenant" | "platform" | "env" | "none";
}

/**
 * Runtime key resolution: tenant override → platform setting → environment.
 * This mirrors the AI provider credential fallback behaviour.
 */
export async function resolveDataSource(
  key: string,
  tenantId?: string | null
): Promise<ResolvedDataSource> {
  const definition = getDataSourceDefinition(key);
  if (!definition) return { secret: null, secondary: null, enabled: false, source: "none" };

  const rows = await prisma.dataSourceCredential.findMany({
    where: {
      providerKey: key,
      OR: [
        { tenantId: "platform" },
        ...(tenantId && tenantId !== "platform" ? [{ tenantId }] : []),
      ],
    },
  });
  const tenantRow = tenantId ? rows.find((r) => r.tenantId === tenantId) : null;
  const platformRow = rows.find((r) => r.tenantId === "platform");
  const row = tenantRow ?? platformRow;

  if (row) {
    if (!row.enabled) {
      return { secret: null, secondary: null, enabled: false, source: row.tenantId === "platform" ? "platform" : "tenant" };
    }
    const secret = decryptSecret(row.encryptedSecret);
    const secondary = row.encryptedSecondary ? decryptSecret(row.encryptedSecondary) : null;
    return {
      secret,
      secondary,
      enabled: true,
      source: row.tenantId === "platform" ? "platform" : "tenant",
    };
  }

  const envSecret = process.env[definition.env] || null;
  const envSecondary = definition.secondaryEnv
    ? process.env[definition.secondaryEnv] || null
    : null;
  if (envSecret || envSecondary) {
    return { secret: envSecret, secondary: envSecondary, enabled: true, source: "env" };
  }

  return { secret: null, secondary: null, enabled: false, source: "none" };
}

export type DataSourceStatus = DataSourceProviderDefinition & {
  configured: boolean;
  enabled: boolean;
  source: "tenant" | "platform" | "env" | "none";
  maskedSecret: string | null;
  maskedSecondary: string | null;
  keyVersion: number | null;
  updatedAt: string | null;
};

export async function listDataSourceStatus(tenantId?: string | null): Promise<DataSourceStatus[]> {
  const rows = await prisma.dataSourceCredential.findMany({
    where: tenantId
      ? { OR: [{ tenantId: "platform" }, { tenantId }] }
      : { tenantId: "platform" },
  });

  return DATA_SOURCE_PROVIDERS.map((definition) => {
    const tenantRow = tenantId ? rows.find((r) => r.tenantId === tenantId && r.providerKey === definition.key) : null;
    const platformRow = rows.find((r) => r.tenantId === "platform" && r.providerKey === definition.key);
    const row = tenantRow ?? platformRow;
    const envSecret = process.env[definition.env] || null;
    const envSecondary = definition.secondaryEnv ? process.env[definition.secondaryEnv] || null : null;
    const source: DataSourceStatus["source"] = row
      ? row.tenantId === "platform" ? "platform" : "tenant"
      : envSecret || envSecondary ? "env" : "none";

    return {
      ...definition,
      configured: Boolean(row || envSecret || envSecondary),
      enabled: row ? row.enabled : Boolean(envSecret || envSecondary),
      source,
      maskedSecret: row?.lastFour
        ? `****${row.lastFour}`
        : envSecret ? maskSecret(envSecret) : null,
      maskedSecondary: row?.encryptedSecondary ? "********" : envSecondary ? maskSecret(envSecondary) : null,
      keyVersion: row?.keyVersion ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

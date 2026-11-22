import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/encryption";

/** Platform scope is stored as a real string so the unique index works in MySQL. */
export const PLATFORM_SCOPE = "platform";

export type CredentialSource = "company" | "platform" | "environment" | "none";

export interface ProviderKeyStatus {
  providerId: string;
  providerKey: string;
  scopeId: string;
  configured: boolean;
  enabled: boolean;
  source: CredentialSource;
  inherited: boolean;
  maskedSecret: string | null;
  lastFour: string | null;
  keyVersion: number | null;
  updatedAt: string | null;
}

export interface ProviderKeyScope {
  id: string;
  name: string;
  slug: string;
  status: string | null;
}

const ENV_KEY_BY_PROVIDER: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google_gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai_grok: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
};

/** Ollama uses a base URL instead of a secret key. */
export function envCredentialFor(providerKey: string): string | null {
  if (providerKey === "ollama") {
    return process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  }
  const envName = ENV_KEY_BY_PROVIDER[providerKey];
  const value = envName ? process.env[envName] : undefined;
  return value && value.trim() ? value.trim() : null;
}

export function normalizeScope(tenantId?: string | null): string {
  return !tenantId || tenantId === PLATFORM_SCOPE ? PLATFORM_SCOPE : tenantId;
}

function safeDecrypt(encrypted: string): string | null {
  try {
    return decryptSecret(encrypted);
  } catch (error) {
    console.error("[ai-credentials] Could not decrypt stored key:", error);
    return null;
  }
}

/**
 * Resolve a provider key with precedence:
 * company override -> global platform key -> environment variable.
 * A disabled company key falls through to the global key.
 */
export async function resolveProviderCredential(
  providerId: string,
  tenantId?: string | null
): Promise<string | null> {
  const provider = await prisma.aIProvider.findUnique({
    where: { id: providerId },
    select: { providerKey: true },
  });
  if (!provider) return null;

  const scope = normalizeScope(tenantId);
  if (scope !== PLATFORM_SCOPE) {
    const companyRow = await prisma.aICredential.findUnique({
      where: { tenantId_providerId: { tenantId: scope, providerId } },
    });
    if (companyRow?.enabled) {
      const secret = safeDecrypt(companyRow.encryptedSecret);
      if (secret) return secret;
    }
  }

  let platformRow = await prisma.aICredential.findUnique({
    where: {
      tenantId_providerId: { tenantId: PLATFORM_SCOPE, providerId },
    },
  });
  if (!platformRow) {
    // Backward compatibility for databases that still contain NULL platform rows.
    platformRow = await prisma.aICredential.findFirst({
      where: { providerId, tenantId: null as any },
    });
  }
  if (platformRow?.enabled) {
    const secret = safeDecrypt(platformRow.encryptedSecret);
    if (secret) return secret;
  }

  return envCredentialFor(provider.providerKey);
}

export async function saveProviderCredential(
  providerId: string,
  secret: string,
  tenantId?: string | null
) {
  const scope = normalizeScope(tenantId);
  const encrypted = encryptSecret(secret);
  const lastFour = secret.slice(-4);

  return prisma.aICredential.upsert({
    where: { tenantId_providerId: { tenantId: scope, providerId } },
    create: {
      tenantId: scope,
      providerId,
      encryptedSecret: encrypted,
      keyVersion: 1,
      lastFour,
      enabled: true,
    },
    update: {
      encryptedSecret: encrypted,
      keyVersion: { increment: 1 },
      lastFour,
      enabled: true,
      updatedAt: new Date(),
    },
  });
}

export async function removeProviderCredential(
  providerId: string,
  tenantId?: string | null
) {
  return prisma.aICredential.deleteMany({
    where: { providerId, tenantId: normalizeScope(tenantId) },
  });
}

export async function setProviderCredentialEnabled(
  providerId: string,
  enabled: boolean,
  tenantId?: string | null
) {
  return prisma.aICredential.update({
    where: {
      tenantId_providerId: {
        tenantId: normalizeScope(tenantId),
        providerId,
      },
    },
    data: { enabled, updatedAt: new Date() },
  });
}

export interface ProviderKeyMatrix {
  scopes: ProviderKeyScope[];
  statuses: ProviderKeyStatus[];
}

/** Everything the admin key matrix needs in one query-friendly response. */
export async function listProviderKeyMatrix(): Promise<ProviderKeyMatrix> {
  const [providers, credentials, tenants] = await Promise.all([
    prisma.aIProvider.findMany({
      orderBy: [{ enabled: "desc" }, { displayName: "asc" }],
      select: { id: true, providerKey: true, displayName: true, enabled: true },
    }),
    prisma.aICredential.findMany(),
    prisma.tenant.findMany({
      where: { slug: { not: "platform" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, status: true },
    }),
  ]);

  const scopes: ProviderKeyScope[] = [
    { id: PLATFORM_SCOPE, name: "Global (all companies)", slug: "platform", status: null },
    ...tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: String(t.status),
    })),
  ];

  const statuses: ProviderKeyStatus[] = [];
  for (const provider of providers) {
    const envKey = envCredentialFor(provider.providerKey);
    const platformRow =
      credentials.find(
        (c) => c.providerId === provider.id && c.tenantId === PLATFORM_SCOPE
      ) ??
      credentials.find(
        (c) => c.providerId === provider.id && (c.tenantId as any) == null
      );

    for (const scope of scopes) {
      const ownRow = credentials.find(
        (c) => c.providerId === provider.id && c.tenantId === scope.id
      );
      const row = scope.id === PLATFORM_SCOPE ? platformRow : ownRow;
      const inherited = scope.id !== PLATFORM_SCOPE && !ownRow && Boolean(platformRow);
      const fromEnv = scope.id === PLATFORM_SCOPE && !row && Boolean(envKey);
      const source: CredentialSource = ownRow && scope.id !== PLATFORM_SCOPE
        ? "company"
        : row
          ? "platform"
          : envKey
            ? "environment"
            : "none";
      const masked = row?.lastFour
        ? `****${row.lastFour}`
        : envKey && !inherited
          ? maskSecret(envKey)
          : null;

      statuses.push({
        providerId: provider.id,
        providerKey: provider.providerKey,
        scopeId: scope.id,
        configured: Boolean(row || envKey),
        enabled: row ? row.enabled : Boolean(envKey),
        source: inherited ? "platform" : source,
        inherited,
        maskedSecret: masked,
        lastFour: row?.lastFour ?? null,
        keyVersion: row?.keyVersion ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
      });
    }
  }

  return { scopes, statuses };
}

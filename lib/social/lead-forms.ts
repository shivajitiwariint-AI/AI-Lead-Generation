import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import { recordAudit, recordLeadActivity } from "@/lib/activity";

/**
 * Official lead-form webhooks only (Meta Lead Ads, LinkedIn Lead Gen Forms).
 * Every request must carry a valid HMAC signature. Contact details come only
 * from the provider payload/API — nothing is guessed or generated here.
 */

export type LeadFormPlatform = "meta" | "linkedin";

export interface WebhookHints {
  accountIds: string[];
  formIds: string[];
}

export interface CampaignConfig {
  tenantId: string;
  rowId?: string;
  appSecret: string | null;
  accessToken: string | null;
  verifyToken: string | null;
}

const ENV: Record<LeadFormPlatform, { secret: string; token: string; verify: string }> = {
  meta: {
    secret: "META_APP_SECRET",
    token: "META_PAGE_ACCESS_TOKEN",
    verify: "META_VERIFY_TOKEN",
  },
  linkedin: {
    secret: "LINKEDIN_CLIENT_SECRET",
    token: "LINKEDIN_ACCESS_TOKEN",
    verify: "LINKEDIN_VERIFY_TOKEN",
  },
};

function decryptOrNull(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

export function hmacHex(secret: string, raw: string): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = a.replace(/^sha256=/i, "").trim().toLowerCase();
  const right = b.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!left || !right || left.length !== right.length) return false;
  try {
    return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
  } catch {
    return false;
  }
}

/** All configs whose secrets could legitimately have signed this request. */
export async function candidateConfigs(
  platform: LeadFormPlatform,
  hints: WebhookHints,
  explicitTenantId?: string | null
): Promise<CampaignConfig[]> {
  const rows = await prisma.socialCampaignSource.findMany({
    where: { platform, enabled: true },
    orderBy: { createdAt: "asc" },
  });

  const accountHints = hints.accountIds.map((v) => String(v).trim()).filter(Boolean);
  const formHints = hints.formIds.map((v) => String(v).trim()).filter(Boolean);

  const configs: CampaignConfig[] = rows
    .filter((row) => {
      if (explicitTenantId) return row.tenantId === explicitTenantId;
      if (accountHints.length === 0 && formHints.length === 0) return true;
      const accountMatch = row.externalAccountId
        ? accountHints.includes(String(row.externalAccountId))
        : false;
      const formMatch = Array.isArray(row.formIds)
        ? (row.formIds as unknown[]).some((id) => formHints.includes(String(id)))
        : false;
      return accountMatch || formMatch;
    })
    .map((row) => ({
      tenantId: row.tenantId,
      rowId: row.id,
      appSecret: decryptOrNull(row.encryptedAppSecret),
      accessToken: decryptOrNull(row.encryptedAccessToken),
      verifyToken: decryptOrNull(row.encryptedVerifyToken),
    }));

  const envConfig: CampaignConfig = {
    tenantId: String(explicitTenantId ?? ""),
    appSecret: process.env[ENV[platform].secret]?.trim() || null,
    accessToken: process.env[ENV[platform].token]?.trim() || null,
    verifyToken: process.env[ENV[platform].verify]?.trim() || null,
  };
  if (envConfig.tenantId && (envConfig.appSecret || envConfig.verifyToken || envConfig.accessToken)) {
    configs.push(envConfig);
  }

  return configs;
}

/** Return the config whose secret produced this signature, if any. */
export function findSignedConfig(
  raw: string,
  signature: string,
  configs: CampaignConfig[]
): CampaignConfig | null {
  if (!signature) return null;
  for (const config of configs) {
    if (!config.appSecret) continue;
    if (safeEqualHex(signature, hmacHex(config.appSecret, raw))) return config;
  }
  return null;
}

export function findVerifyConfig(
  token: string,
  configs: CampaignConfig[]
): CampaignConfig | null {
  if (!token) return null;
  return configs.find((config) => config.verifyToken && config.verifyToken === token) ?? null;
}

export function explicitTenantFrom(req: {
  headers: { get(name: string): string | null };
  nextUrl: { searchParams: { get(name: string): string | null } };
}): string | null {
  const header = req.headers.get("x-tenant-id")?.trim();
  const query = req.nextUrl.searchParams.get("tenantId")?.trim();
  return query || header || null;
}

export async function tenantExists(tenantId: string): Promise<boolean> {
  if (!tenantId || tenantId === "platform") return false;
  return Boolean(
    await prisma.tenant.findFirst({
      where: { id: tenantId, slug: { not: "platform" } },
      select: { id: true },
    })
  );
}

type FieldEntry = { name?: string; values?: unknown[]; value?: unknown };

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Accept Meta `field_data[]`, LinkedIn `leadGenFormData.values[]`, or a plain object. */
export function mapFormFields(raw: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  const assign = (key: unknown, value: unknown) => {
    if (key == null) return;
    const normalized = normalizeKey(String(key));
    const text = Array.isArray(value)
      ? value.map((v) => String(v ?? "")).join(", ").trim()
      : String(value ?? "").trim();
    if (normalized && text && text !== "null" && text !== "undefined") {
      result[normalized] = text.slice(0, 500);
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw as FieldEntry[]) {
      if (!item || typeof item !== "object") continue;
      const key =
        item.name ??
        (item as any)?.fieldName?.localizedName ??
        (item as any)?.fieldName ??
        (item as any)?.label;
      const value = item.values?.length ? item.values[0] : item.value ?? (item as any)?.values;
      assign(key, value);
    }
  } else if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      assign(key, value);
    }
  }
  return result;
}

function firstField(fields: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    if (fields[key]) return fields[key];
  }
  return null;
}

const TRUTHY = new Set(["true", "yes", "1", "y", "agree", "agreed", "optin", "optedin", "consent", "subscribe", "subscribed"]);

function hasMarketingConsent(fields: Record<string, string>): boolean {
  const keys = [
    "consent",
    "marketingconsent",
    "optin",
    "optedin",
    "permission",
    "subscribe",
    "newsletter",
    "communicationconsent",
  ];
  return keys.some((key) => {
    const value = fields[key];
    return value ? TRUTHY.has(normalizeKey(value)) : false;
  });
}

export interface LeadFormSubmission {
  tenantId: string;
  platform: LeadFormPlatform;
  externalId: string;
  fields: Record<string, string>;
  formId?: string | null;
  accountId?: string | null;
  adId?: string | null;
  campaignId?: string | null;
  createdTime?: string | null;
  rawFieldNames?: string[];
}

export interface LeadFormResult {
  leadId: string | null;
  created: boolean;
  duplicate: boolean;
  reason?: string;
}

/** Create a consented lead from an official lead-form submission. */
export async function createLeadFromFormSubmission(
  submission: LeadFormSubmission
): Promise<LeadFormResult> {
  const fields = submission.fields;
  const rawName = firstField(fields, [
    "name",
    "fullname",
    "contactname",
    "yourname",
    "firstname",
  ]);
  const firstName = firstField(fields, ["firstname", "first"]);
  const lastName = firstField(fields, ["lastname", "last"]);
  const name = rawName || [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const rawEmail = firstField(fields, ["email", "emailaddress", "workemail", "businessemail"]);
  const email = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  const phone = firstField(fields, ["phone", "phonenumber", "mobile", "mobilenumber", "contactnumber", "telephone"]);
  const company = firstField(fields, ["company", "companyname", "organization", "businessname"]);
  const jobTitle = firstField(fields, ["jobtitle", "title", "designation", "position"]);
  const website = firstField(fields, ["website", "companywebsite", "url"]);

  if (!name && !email && !phone) {
    return { leadId: null, created: false, duplicate: false, reason: "No contact details in form submission" };
  }

  const sourceType = submission.platform === "meta" ? "meta_lead_form" : "linkedin_lead_form";
  const externalId = String(submission.externalId ?? "").slice(0, 255);
  if (!externalId) {
    return { leadId: null, created: false, duplicate: false, reason: "Missing provider lead id" };
  }

  const sourceByExternalId = await prisma.leadSource.findFirst({
    where: { tenantId: submission.tenantId, sourceType, externalId },
    select: { leadId: true },
  });
  if (sourceByExternalId) {
    return { leadId: sourceByExternalId.leadId, created: false, duplicate: true };
  }

  let existing = null;
  if (email) {
    existing = await prisma.lead.findFirst({
      where: { tenantId: submission.tenantId, email },
      select: { id: true, consentMarketing: true },
    });
  }
  if (!existing && phone) {
    existing = await prisma.lead.findFirst({
      where: { tenantId: submission.tenantId, phone },
      select: { id: true, consentMarketing: true },
    });
  }

  const consent = hasMarketingConsent(fields);
  const parsedCreatedAt = submission.createdTime
    ? new Date(submission.createdTime)
    : null;
  const capturedAt =
    parsedCreatedAt && !Number.isNaN(parsedCreatedAt.getTime())
      ? parsedCreatedAt
      : new Date();
  const consentMethod = `${submission.platform}_lead_form`;

  let leadId: string;
  let created = false;

  if (existing) {
    leadId = existing.id;
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        // This contact was supplied by a signed first-party form, even if an
        // earlier research record already existed for the same email/phone.
        verified: true,
        ...(consent && !existing.consentMarketing
          ? {
              consentMarketing: true,
              consentCapturedAt: capturedAt,
              consentMethod,
            }
          : {}),
      },
    });
  } else {
    const lead = await prisma.lead.create({
      data: {
        tenantId: submission.tenantId,
        name: String(name || email || phone).slice(0, 200),
        email,
        phone: phone ? String(phone).slice(0, 50) : null,
        company: company ? String(company).slice(0, 200) : null,
        website: website && /^https?:\/\//i.test(website) ? String(website).slice(0, 500) : null,
        industry: null,
        location: null,
        requirement: jobTitle ? `Job title: ${jobTitle}` : null,
        status: "new",
        score: 0,
        // A lead form is a first-party submission, not a scraped/guessed contact.
        verified: true,
        consentMarketing: consent,
        consentCapturedAt: consent ? capturedAt : null,
        consentMethod: consent ? consentMethod : null,
        controlMode: "ai",
      },
    });
    leadId = lead.id;
    created = true;
  }

  await prisma.leadSource.create({
    data: {
      tenantId: submission.tenantId,
      leadId,
      sourceType,
      externalId,
      attribution: JSON.stringify({
        platform: submission.platform,
        source: sourceType,
        formId: submission.formId ?? null,
        accountId: submission.accountId ?? null,
        adId: submission.adId ?? null,
        campaignId: submission.campaignId ?? null,
        createdTime: submission.createdTime ?? null,
        capturedAt: capturedAt.toISOString(),
        verified: true,
        consentMarketing: consent,
        fieldNames: submission.rawFieldNames ?? Object.keys(fields),
      }),
    },
  });

  if (consent) {
    await prisma.consentRecord.create({
      data: {
        tenantId: submission.tenantId,
        leadId,
        purpose: "marketing",
        status: "granted",
        capturedAt,
        source: consentMethod,
        policyVersion: null,
      },
    });
  }

  await recordLeadActivity({
    tenantId: submission.tenantId,
    leadId,
    actorId: null,
    activityType: "lead_created",
    payload: {
      source: sourceType,
      externalId,
      formId: submission.formId ?? null,
      verified: true,
      consentMarketing: consent,
      duplicate: !created,
    },
  });

  await recordAudit({
    tenantId: submission.tenantId,
    actorId: null,
    actorType: "system",
    action: "social.lead_form_received",
    category: "lead",
    targetType: "lead",
    targetId: leadId,
    metadata: {
      platform: submission.platform,
      formId: submission.formId ?? null,
      externalId,
      created,
      duplicate: !created,
      consentMarketing: consent,
    },
  });

  return { leadId, created, duplicate: !created };
}

/** Record an idempotency key. Returns false when it was already processed. */
export async function claimWebhookEvent(
  tenantId: string,
  provider: string,
  externalEventId: string
): Promise<boolean> {
  const key = `${provider}:${externalEventId}`.slice(0, 255);
  if (
    await prisma.webhookEvent.findUnique({
      where: { externalEventId: key },
      select: { id: true },
    })
  ) {
    return false;
  }
  try {
    await prisma.webhookEvent.create({
      data: {
        tenantId,
        provider,
        externalEventId: key,
        processedAt: new Date(),
      },
    });
    return true;
  } catch {
    // Concurrent delivery: the unique index decides the winner.
    return false;
  }
}

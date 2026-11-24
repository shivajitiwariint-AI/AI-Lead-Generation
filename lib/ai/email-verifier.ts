import { resolveDataSource } from "@/lib/data-sources";

/**
 * Disposable / free email domains that should not be treated as verified business
 * contacts. Keep this list short — full blocklists are maintained by the
 * verification provider (Hunter.io) when configured.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "dispostable.com",
  "temp-mail.org",
  "throwaway.email",
  "fakeinbox.com",
  "trashmail.com",
]);

const FREE_WEBMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.ca",
  "yahoo.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "protonmail.com",
]);

export interface EmailVerificationResult {
  email: string;
  valid: boolean;
  disposable: boolean;
  freeWebmail: boolean;
  deliverable: boolean | null; // null when provider not configured
  confidence: number; // 0-1
  reason: string;
  provider: "none" | "hunter";
}

/** Fast local checks: format, disposable domain, free webmail. */
function localChecks(email: string): {
  valid: boolean;
  disposable: boolean;
  freeWebmail: boolean;
  reason: string;
} {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, disposable: false, freeWebmail: false, reason: "Invalid email format" };
  }

  const domain = trimmed.split("@")[1] ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: true, disposable: true, freeWebmail: false, reason: "Disposable email domain" };
  }
  if (FREE_WEBMAIL_DOMAINS.has(domain)) {
    return {
      valid: true,
      disposable: false,
      freeWebmail: true,
      reason: "Free webmail domain — treat with caution",
    };
  }
  return { valid: true, disposable: false, freeWebmail: false, reason: "Local checks passed" };
}

/** Verify an email address. Uses Hunter.io verifier when a key is configured,
 *  otherwise falls back to local checks only. */
export async function verifyEmail(
  email: string | null | undefined,
  tenantId?: string | null
): Promise<EmailVerificationResult> {
  if (!email) {
    return {
      email: "",
      valid: false,
      disposable: false,
      freeWebmail: false,
      deliverable: null,
      confidence: 0,
      reason: "No email provided",
      provider: "none",
    };
  }

  const local = localChecks(email);
  if (!local.valid) {
    return {
      email,
      valid: false,
      disposable: local.disposable,
      freeWebmail: local.freeWebmail,
      deliverable: false,
      confidence: 0,
      reason: local.reason,
      provider: "none",
    };
  }
  if (local.disposable) {
    return {
      email,
      valid: false,
      disposable: true,
      freeWebmail: false,
      deliverable: false,
      confidence: 0,
      reason: local.reason,
      provider: "none",
    };
  }

  // Use a dedicated verifier key if one is configured. Otherwise reuse the
  // normal Hunter.io key so admins only have to paste it once.
  const [dedicated, hunter] = await Promise.all([
    resolveDataSource("email_verifier", tenantId ?? null).catch(() => null),
    resolveDataSource("hunter", tenantId ?? null).catch(() => null),
  ]);
  const source = [dedicated, hunter].find((s) => s?.secret && s.enabled) ?? null;
  if (source?.secret) {
    try {
      const params = new URLSearchParams({ email, api_key: source.secret });
      const res = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const result = data?.data ?? {};
        const status = String(result.status ?? "").toLowerCase();
        const deliverable = status === "valid";
        const confidence = Number(result.confidence ?? 0) / 100;
        return {
          email,
          valid: deliverable && !local.disposable,
          disposable: false,
          freeWebmail: local.freeWebmail,
          deliverable,
          confidence,
          reason: `Hunter.io: ${result.status ?? "unknown"}`,
          provider: "hunter",
        };
      }
    } catch {
      /* fall through to local-only result */
    }
  }

  // Local-only: accept non-disposable, non-free-webmail domains as plausibly valid.
  return {
    email,
    valid: !local.freeWebmail,
    disposable: false,
    freeWebmail: local.freeWebmail,
    deliverable: null,
    confidence: local.freeWebmail ? 0.3 : 0.6,
    reason: local.reason,
    provider: "none",
  };
}

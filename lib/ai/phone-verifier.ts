import { resolveDataSource } from "@/lib/data-sources";

export interface PhoneVerificationResult {
  phone: string;
  valid: boolean;
  e164: string | null;
  country: string | null;
  carrier: string | null;
  lineType: string | null;
  verified: boolean;
  confidence: number;
  reason: string;
}

/** Minimal E.164 format check when no provider is configured. */
function formatCheck(phone: string): {
  valid: boolean;
  e164: string | null;
  reason: string;
} {
  const digits = phone.replace(/\D/g, "");
  // Must be between 7 and 15 digits (E.164 max is 15).
  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, e164: null, reason: "Invalid phone number length" };
  }
  const e164 = `+${digits}`;
  return { valid: true, e164, reason: "Format looks valid" };
}

export async function verifyPhone(
  phone: string | null | undefined,
  tenantId?: string | null
): Promise<PhoneVerificationResult> {
  if (!phone) {
    return {
      phone: "",
      valid: false,
      e164: null,
      country: null,
      carrier: null,
      lineType: null,
      verified: false,
      confidence: 0,
      reason: "No phone provided",
    };
  }

  const fmt = formatCheck(phone);
  if (!fmt.valid) {
    return {
      phone,
      valid: false,
      e164: null,
      country: null,
      carrier: null,
      lineType: null,
      verified: false,
      confidence: 0,
      reason: fmt.reason,
    };
  }

  // Try a phone verification provider when configured.
  const source = await resolveDataSource("phone_verifier", tenantId ?? null).catch(() => null);
  if (source?.secret && fmt.e164) {
    try {
      const res = await fetch(
        `https://api.example.com/v1/phones/${encodeURIComponent(fmt.e164)}`,
        {
          headers: { Authorization: `Bearer ${source.secret}` },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        return {
          phone,
          valid: data.valid ?? false,
          e164: fmt.e164 ?? null,
          country: data.country ?? null,
          carrier: data.carrier ?? null,
          lineType: data.lineType ?? null,
          verified: data.valid ?? false,
          confidence: Number(data.confidence ?? 0.8),
          reason: "Provider verified",
        };
      }
    } catch {
      /* fall through to format-only result */
    }
  }

  // Format-only: plausibly valid but not actually verified.
  return {
    phone,
    valid: true,
    e164: fmt.e164,
    country: null,
    carrier: null,
    lineType: null,
    verified: false,
    confidence: 0.5,
    reason: fmt.reason,
  };
}

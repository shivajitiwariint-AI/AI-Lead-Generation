import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

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

function defaultCountry(): CountryCode {
  const configured = (process.env.DEFAULT_PHONE_COUNTRY || "IN").toUpperCase();
  // libphonenumber-js validates the country code at parse time; fall back to IN
  // if an unsupported value was configured.
  return /^[A-Z]{2}$/.test(configured) ? (configured as CountryCode) : "IN";
}

/**
 * Real phone-number validation using Google's libphonenumber metadata.
 *
 * This checks that the number parses, the country calling code is real, and
 * the national number has a possible length for that country. It does NOT
 * prove the line is allocated or reachable — that requires a paid carrier
 * lookup provider (Twilio Lookup, Numverify, etc.). `verified` therefore
 * stays false, and the reason explains the distinction.
 */
function formatCheck(phone: string): {
  valid: boolean;
  e164: string | null;
  country: string | null;
  lineType: string | null;
  confidence: number;
  reason: string;
} {
  const parsed = parsePhoneNumberFromString(phone.trim(), defaultCountry());
  if (!parsed) {
    return {
      valid: false,
      e164: null,
      country: null,
      lineType: null,
      confidence: 0,
      reason: "Not a recognisable phone number",
    };
  }
  if (!parsed.isPossible()) {
    return {
      valid: false,
      e164: null,
      country: parsed.country ?? null,
      lineType: null,
      confidence: 0,
      reason: `Invalid length for ${parsed.country ?? "the country calling code"}`,
    };
  }

  const exact = parsed.isValid();
  return {
    valid: true,
    e164: parsed.number,
    country: parsed.country ?? null,
    lineType: parsed.getType() ?? null,
    confidence: exact ? 0.75 : 0.55,
    reason: exact
      ? "Valid number for its country"
      : "Format is possible; carrier allocation not confirmed",
  };
}

export async function verifyPhone(
  phone: string | null | undefined,
  _tenantId?: string | null
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
      country: fmt.country,
      carrier: null,
      lineType: null,
      verified: false,
      confidence: 0,
      reason: fmt.reason,
    };
  }

  return {
    phone,
    valid: true,
    e164: fmt.e164,
    country: fmt.country,
    carrier: null,
    lineType: fmt.lineType,
    verified: false,
    confidence: fmt.confidence,
    reason: fmt.reason,
  };
}

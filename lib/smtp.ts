import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret, maskSecret } from "@/lib/encryption";
import crypto from "crypto";

export interface SystemSmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string | null;
}

/**
 * System-wide SMTP settings supplied through environment variables.
 * Used whenever a company has not configured its own SMTP credentials.
 */
export function getSystemSmtpSettings(): SystemSmtpSettings | null {
  const host = process.env.SMTP_HOST?.trim();
  const username = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const fromEmail = process.env.SMTP_FROM?.trim() || username;
  if (!host || !username || !password || !fromEmail) return null;

  const parsedPort = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 587;
  const secureFlag = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureFlag ? secureFlag === "true" || secureFlag === "1" : port === 465;

  return {
    host,
    port,
    secure,
    username,
    password,
    fromEmail,
    fromName: process.env.SMTP_FROM_NAME?.trim() || null,
  };
}

/**
 * Returns true when SMTP_* env vars are present.
 */
export function isSystemSmtpConfigured(): boolean {
  return getSystemSmtpSettings() !== null;
}

/**
 * Format a "From" header: `Name <email>` or just `email`.
 */
export function formatFromAddress(email: string, name?: string | null): string {
  return name ? `${name} <${email}>` : email;
}

/**
 * Create a nodemailer Transport from shared settings.
 */
function createTransport(settings: SystemSmtpSettings): Transporter {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: !settings.secure && settings.port === 587 ? true : undefined,
    auth: { user: settings.username, pass: settings.password },
  });
}

/** Transport for the system mailbox configured via SMTP_* environment variables. */
export function getSystemSmtpTransport(): Transporter | null {
  const settings = getSystemSmtpSettings();
  return settings ? createTransport(settings) : null;
}

/** Transport for a company's own SMTP configuration (no env fallback). */
export async function getSmtpTransport(tenantId: string, passwordPlain?: string) {
  const config = await prisma.smtpConfig.findUnique({ where: { tenantId } });
  if (!config || !config.enabled) return null;
  let password = passwordPlain;
  if (!password) {
    try {
      password = decryptSecret(config.passwordEncrypted);
    } catch {
      return null;
    }
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: password ?? "" },
  });
}

export async function verifySmtp(tenantId: string, passwordPlain?: string) {
  const transport = await getSmtpTransport(tenantId, passwordPlain);
  if (!transport) throw new Error("No enabled SMTP config for this company");
  await transport.verify();
  return true;
}

export async function sendViaSmtp(
  tenantId: string,
  opts: { to: string; subject: string; text: string; html?: string }
) {
  const config = await prisma.smtpConfig.findUnique({ where: { tenantId } });
  if (!config || !config.enabled) throw new Error("SMTP not configured for this company");
  const transport = await getSmtpTransport(tenantId);
  if (!transport) throw new Error("SMTP credentials could not be decrypted");
  const from = formatFromAddress(config.fromEmail, config.fromName);
  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, "<br/>"),
  });
}

/**
 * Send a transactional email through the system mailbox.
 * Throws when SMTP_* environment variables are not configured.
 */
export async function sendSystemEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}) {
  const settings = getSystemSmtpSettings();
  if (!settings) throw new Error("System SMTP is not configured");
  const transport = createTransport(settings);
  return transport.sendMail({
    from: formatFromAddress(settings.fromEmail, settings.fromName),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, "<br/>"),
    replyTo: opts.replyTo,
  });
}

/**
 * Parse common Gmail / SMTP bounce codes from error messages.
 * Returns a short reason string that can be stored in SuppressionEntry.
 */
// @ts-ignore
export function parseGmailBounce(errorMessage: string): string {
  const lower = (errorMessage || "").toLowerCase();

  if (/5\.1\.1|5\.1\.2|5\.1\.3/.test(lower)) return "hard_bounce_user_unknown";
  if (/5\.2\.2|5\.2\.3/.test(lower)) return "hard_bounce_mailbox_unavailable";
  if (/5\.3\.2/.test(lower)) return "hard_bounce_quota_exceeded";
  if (/5\.4\.4/.test(lower)) return "hard_bounce_delivery_failed";
  if (/5\.4\.6/.test(lower)) return "hard_bounce_message_too_large";
  if (/5\.5\.2/.test(lower)) return "hard_bounce_address_rejected";
  if (/4\.2\.2|4\.2\.3/.test(lower)) return "soft_bounce_mailbox_full";
  if (/4\.3\.2/.test(lower)) return "soft_bounce_system_full";
  if (lower.startsWith("4.")) return "soft_bounce_transient";
  return "hard_bounce";
}

/**
 * Send a transactional email through the system mailbox,
 * automatically suppressing addresses that produce hard bounces.
 *
 * Returns { success: true, messageId } on success,
 * or { success: false, bounceReason } when a hard bounce is detected.
 *
 * On a hard bounce the function creates/updates a SuppressionEntry
 * so future sends to that address are blocked.
 */
export async function sendWithBounceTracking(
  opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    tenantId: string;
  }
): Promise<{ success: true; messageId: string } | { success: false; bounceReason: string }> {
  const settings = getSystemSmtpSettings();
  if (!settings) throw new Error("System SMTP is not configured");

  const transport = createTransport(settings);
  const toAddress = opts.to.trim();

  // @ts-ignore
const mailOptions: nodemailer.MailOptions = {
    from: formatFromAddress(settings.fromEmail, settings.fromName),
    to: toAddress,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, "<br/>"),
    replyTo: opts.replyTo,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const bounceReason = parseGmailBounce(err.message || "");

    // If it looks like a hard bounce, add the address to the suppression list
    // so future sends never try again.
    if (bounceReason.startsWith("hard_bounce")) {
      const contactHash = crypto.createHash("sha256").update(toAddress.trim().toLowerCase()).digest("hex");
      await prisma.suppressionEntry.upsert({
        // @ts-ignore
        where: { tenantId_contactHash: { tenantId: opts.tenantId, contactHash } },
        // @ts-ignore
        update: { reason: bounceReason, channel: "email", updatedAt: new Date() },
        create: { tenantId: opts.tenantId, contactHash, reason: bounceReason, channel: "email" },
      });
    }

    return { success: false, bounceReason };
  }
}

/** Convenience: enqueue then immediately drain (keeps local runs responsive). */
export function maskPassword(encrypted: string) {
  try {
    return maskSecret(decryptSecret(encrypted));
  } catch {
    return "****";
  }
}

/** Parse a bounce webhook payload and store the suppression entry. */
export async function handleBounceWebhook(params: {
  tenantId: string;
  to: string;
  bounceReason: string;
  messageId?: string;
}) {
  const contactHash = crypto.createHash("sha256").update(params.to.trim().toLowerCase()).digest("hex");
  await prisma.suppressionEntry.upsert({
    // @ts-ignore
    where: { tenantId_contactHash: { tenantId: params.tenantId, contactHash } },
    // @ts-ignore
    update: { reason: params.bounceReason, channel: "email", updatedAt: new Date() },
    create: { tenantId: params.tenantId, contactHash, reason: params.bounceReason, channel: "email" },
  });
}
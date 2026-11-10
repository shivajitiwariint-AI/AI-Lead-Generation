import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret, maskSecret } from "@/lib/encryption";

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

export function isSystemSmtpConfigured(): boolean {
  return getSystemSmtpSettings() !== null;
}

export function formatFromAddress(email: string, name?: string | null): string {
  return name ? `${name} <${email}>` : email;
}

function createTransport(settings: SystemSmtpSettings): Transporter {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    // Port 587 expects STARTTLS, so require an encrypted upgrade.
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

export function maskPassword(encrypted: string) {
  try {
    return maskSecret(decryptSecret(encrypted));
  } catch {
    return "****";
  }
}

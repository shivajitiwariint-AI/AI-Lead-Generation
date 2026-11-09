import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret, maskSecret } from "@/lib/encryption";

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
  const from = config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;
  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, "<br/>"),
  });
}

export function maskPassword(encrypted: string) {
  try {
    return maskSecret(decryptSecret(encrypted));
  } catch {
    return "****";
  }
}

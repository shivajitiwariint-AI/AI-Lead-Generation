export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/encryption";
import { verifySmtp } from "@/lib/smtp";
import { recordAudit } from "@/lib/activity";

const schema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(500).optional(), // blank = keep existing
  fromEmail: z.string().email().max(255),
  fromName: z.string().max(200).optional().nullable(),
  enabled: z.boolean().default(true),
});

async function requireSuperAdmin(ctx: any) {
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Super admin only" } }, { status: 403 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;
  const config = await prisma.smtpConfig.findUnique({ where: { tenantId: params.id } });
  if (!config) return NextResponse.json({ configured: false });
  let masked = "****";
  try {
    masked = maskSecret(decryptSecret(config.passwordEncrypted));
  } catch {}
  return NextResponse.json({
    configured: true,
    id: config.id,
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.username,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    enabled: config.enabled,
    passwordMasked: masked,
    updatedAt: config.updatedAt,
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
    if (!tenant) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Company not found" } }, { status: 404 });

    const existing = await prisma.smtpConfig.findUnique({ where: { tenantId: params.id } });
    let passwordEncrypted: string;
    if (data.password) {
      passwordEncrypted = encryptSecret(data.password);
    } else if (existing) {
      passwordEncrypted = existing.passwordEncrypted;
    } else {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Password is required for new SMTP config" } }, { status: 400 });
    }

    const saved = await prisma.smtpConfig.upsert({
      where: { tenantId: params.id },
      create: {
        tenantId: params.id,
        host: data.host,
        port: data.port,
        secure: data.secure,
        username: data.username,
        passwordEncrypted,
        fromEmail: data.fromEmail,
        fromName: data.fromName ?? null,
        enabled: data.enabled,
      },
      update: {
        host: data.host,
        port: data.port,
        secure: data.secure,
        username: data.username,
        passwordEncrypted,
        fromEmail: data.fromEmail,
        fromName: data.fromName ?? null,
        enabled: data.enabled,
      },
    });

    await recordAudit({
      tenantId: null,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.smtp_updated",
      category: "config",
      targetType: "smtp_config",
      targetId: saved.id,
      metadata: { tenantId: params.id, host: data.host, port: data.port, fromEmail: data.fromEmail, enabled: data.enabled },
    });

    // Optional live verify when a new password was just supplied
    let verified = false;
    let verifyError: string | undefined;
    if (saved.enabled && data.password) {
      try {
        await verifySmtp(params.id);
        verified = true;
      } catch (e: any) {
        verifyError = String(e?.message ?? e).slice(0, 300);
      }
    }

    return NextResponse.json({ ok: true, configured: true, verified, verifyError });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: err.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;
  try {
    const body = await req.json().catch(() => ({}));
    await verifySmtp(params.id, typeof body?.password === "string" ? body.password : undefined);
    return NextResponse.json({ ok: true, verified: true });
  } catch (err: any) {
    return NextResponse.json({ error: { code: "VERIFY_FAILED", message: String(err?.message ?? err).slice(0, 300) } }, { status: 400 });
  }
}

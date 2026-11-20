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

function canManage(ctx: Awaited<ReturnType<typeof getAuthContext>>) {
  return (
    ctx.isAuthenticated &&
    Boolean(ctx.tenantId) &&
    (ctx.isSuperAdmin ||
      ctx.permissions.includes("integrations:write") ||
      ctx.permissions.includes("settings:write") ||
      ctx.role === "COMPANY_OWNER" ||
      ctx.role === "COMPANY_ADMIN")
  );
}

function forbidden() {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message: "Only workspace admins can manage email settings" } },
    { status: 403 }
  );
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!canManage(ctx)) return forbidden();

  const config = await prisma.smtpConfig.findUnique({ where: { tenantId: ctx.tenantId } });
  if (!config) return NextResponse.json({ configured: false });
  let masked = "****";
  try {
    masked = maskSecret(decryptSecret(config.passwordEncrypted));
  } catch {
    /* keep default mask */
  }
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

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!canManage(ctx)) return forbidden();

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const tenantId = ctx.tenantId;

    const existing = await prisma.smtpConfig.findUnique({ where: { tenantId } });
    let passwordEncrypted: string;
    if (data.password) {
      passwordEncrypted = encryptSecret(data.password);
    } else if (existing) {
      passwordEncrypted = existing.passwordEncrypted;
    } else {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Password is required for a new SMTP configuration" } },
        { status: 400 }
      );
    }

    const saved = await prisma.smtpConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
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
      tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "settings.smtp_updated",
      category: "config",
      targetType: "smtp_config",
      targetId: saved.id,
      metadata: {
        host: data.host,
        port: data.port,
        fromEmail: data.fromEmail,
        enabled: data.enabled,
      },
    });

    let verified = false;
    let verifyError: string | undefined;
    if (saved.enabled && data.password) {
      try {
        await verifySmtp(tenantId);
        verified = true;
      } catch (e: any) {
        verifyError = String(e?.message ?? e).slice(0, 300);
      }
    }

    return NextResponse.json({ ok: true, configured: true, verified, verifyError });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: err.issues?.[0]?.message ?? err.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!canManage(ctx)) return forbidden();

  try {
    const body = await req.json().catch(() => ({}));
    await verifySmtp(ctx.tenantId, typeof body?.password === "string" ? body.password : undefined);
    return NextResponse.json({ ok: true, verified: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "VERIFY_FAILED", message: String(err?.message ?? err).slice(0, 300) } },
      { status: 400 }
    );
  }
}

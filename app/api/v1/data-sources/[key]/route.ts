export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";
import { getDataSourceDefinition, listDataSourceStatus, resolveDataSource } from "@/lib/data-sources";
import { recordAudit } from "@/lib/activity";

const saveSchema = z.object({
  secret: z.string().min(1, "API key is required"),
  secondary: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

const toggleSchema = z.object({
  enabled: z.boolean(),
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
    { error: { code: "FORBIDDEN", message: "Only workspace admins can manage data source keys" } },
    { status: 403 }
  );
}

export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
  }
  if (!getDataSourceDefinition(params.key)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown data source" } }, { status: 404 });
  }
  const resolved = await resolveDataSource(params.key, ctx.tenantId);
  return NextResponse.json({
    providerKey: params.key,
    configured: Boolean(resolved.secret || resolved.secondary),
    enabled: resolved.enabled,
    source: resolved.source,
  });
}

export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  const ctx = await getAuthContext();
  if (!canManage(ctx)) return forbidden();
  if (!ctx.tenantId) return forbidden();

  const definition = getDataSourceDefinition(params.key);
  if (!definition) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown data source" } }, { status: 404 });
  }

  try {
    const data = saveSchema.parse(await req.json());
    const lastFour = data.secret.slice(-4);
    const existing = await prisma.dataSourceCredential.findUnique({
      where: { tenantId_providerKey: { tenantId: ctx.tenantId, providerKey: params.key } },
    });

    await prisma.dataSourceCredential.upsert({
      where: { tenantId_providerKey: { tenantId: ctx.tenantId, providerKey: params.key } },
      create: {
        tenantId: ctx.tenantId,
        providerKey: params.key,
        encryptedSecret: encryptSecret(data.secret),
        encryptedSecondary: definition.secondaryLabel && data.secondary ? encryptSecret(data.secondary) : null,
        keyVersion: 1,
        lastFour,
        enabled: data.enabled ?? true,
      },
      update: {
        encryptedSecret: encryptSecret(data.secret),
        encryptedSecondary: definition.secondaryLabel && data.secondary ? encryptSecret(data.secondary) : null,
        keyVersion: (existing?.keyVersion ?? 0) + 1,
        lastFour,
        enabled: data.enabled ?? true,
        updatedAt: new Date(),
      },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "data_source_key_saved",
      category: "config",
      targetType: "data_source",
      targetId: params.key,
      metadata: { providerKey: params.key, scope: ctx.tenantId, lastFour },
    });

    return NextResponse.json({ ok: true, providerKey: params.key, masked: `****${lastFour}` });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: error.message } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  const ctx = await getAuthContext();
  if (!canManage(ctx)) return forbidden();
  if (!ctx.tenantId) return forbidden();

  const definition = getDataSourceDefinition(params.key);
  if (!definition) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown data source" } }, { status: 404 });
  }

  try {
    const data = toggleSchema.parse(await req.json());
    const existing = await prisma.dataSourceCredential.findUnique({
      where: { tenantId_providerKey: { tenantId: ctx.tenantId, providerKey: params.key } },
    });
    if (!existing) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "No saved key for this source" } }, { status: 404 });
    }
    await prisma.dataSourceCredential.update({
      where: { id: existing.id },
      data: { enabled: data.enabled, updatedAt: new Date() },
    });
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "data_source_toggled",
      category: "config",
      targetType: "data_source",
      targetId: params.key,
      metadata: { providerKey: params.key, enabled: data.enabled },
    });
    return NextResponse.json({ ok: true, enabled: data.enabled });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { key: string } }) {
  const ctx = await getAuthContext();
  if (!canManage(ctx)) return forbidden();
  if (!ctx.tenantId) return forbidden();

  const definition = getDataSourceDefinition(params.key);
  if (!definition) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown data source" } }, { status: 404 });
  }

  await prisma.dataSourceCredential.deleteMany({
    where: { tenantId: ctx.tenantId, providerKey: params.key },
  });
  await recordAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "data_source_key_removed",
    category: "config",
    targetType: "data_source",
    targetId: params.key,
  });
  return NextResponse.json({ ok: true });
}

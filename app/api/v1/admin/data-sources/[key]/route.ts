export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";
import { getDataSourceDefinition, resolveDataSource } from "@/lib/data-sources";
import { recordAudit } from "@/lib/activity";

const saveSchema = z.object({
  secret: z.string().min(1, "API key is required"),
  secondary: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  tenantId: z.string().optional().nullable(),
});

const toggleSchema = z.object({
  enabled: z.boolean(),
  tenantId: z.string().optional().nullable(),
});

function scopeOf(body: { tenantId?: string | null }) {
  return body.tenantId && body.tenantId !== "platform" ? body.tenantId : "platform";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const ctx = await requireSuperAdmin();
    const definition = getDataSourceDefinition(params.key);
    if (!definition) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Unknown data source" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data = saveSchema.parse(body);
    const tenantId = scopeOf(data);
    const lastFour = data.secret.slice(-4);

    const existing = await prisma.dataSourceCredential.findUnique({
      where: { tenantId_providerKey: { tenantId, providerKey: params.key } },
    });

    await prisma.dataSourceCredential.upsert({
      where: { tenantId_providerKey: { tenantId, providerKey: params.key } },
      create: {
        tenantId,
        providerKey: params.key,
        encryptedSecret: encryptSecret(data.secret),
        encryptedSecondary: definition.secondaryLabel && data.secondary
          ? encryptSecret(data.secondary)
          : null,
        keyVersion: 1,
        lastFour,
        enabled: data.enabled ?? true,
      },
      update: {
        encryptedSecret: encryptSecret(data.secret),
        encryptedSecondary: definition.secondaryLabel && data.secondary
          ? encryptSecret(data.secondary)
          : null,
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
      action: "admin.data_source_key_saved",
      category: "config",
      targetType: "data_source",
      targetId: params.key,
      metadata: { providerKey: params.key, scope: tenantId, lastFour },
    });

    return NextResponse.json({
      ok: true,
      providerKey: params.key,
      scope: tenantId,
      masked: `****${lastFour}`,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const ctx = await requireSuperAdmin();
    const definition = getDataSourceDefinition(params.key);
    if (!definition) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Unknown data source" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data = toggleSchema.parse(body);
    const tenantId = scopeOf(data);
    const existing = await prisma.dataSourceCredential.findUnique({
      where: { tenantId_providerKey: { tenantId, providerKey: params.key } },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No saved credential for this source" } },
        { status: 404 }
      );
    }

    await prisma.dataSourceCredential.update({
      where: { id: existing.id },
      data: { enabled: data.enabled, updatedAt: new Date() },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.data_source_toggled",
      category: "config",
      targetType: "data_source",
      targetId: params.key,
      metadata: { providerKey: params.key, enabled: data.enabled, scope: tenantId },
    });

    return NextResponse.json({ ok: true, enabled: data.enabled });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const ctx = await requireSuperAdmin();
    if (!getDataSourceDefinition(params.key)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Unknown data source" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tenantId = scopeOf({ tenantId: searchParams.get("tenantId") });
    await prisma.dataSourceCredential.deleteMany({
      where: { tenantId, providerKey: params.key },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.data_source_key_removed",
      category: "config",
      targetType: "data_source",
      targetId: params.key,
      metadata: { providerKey: params.key, scope: tenantId },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

/** Test that a saved credential resolves (does not send the key back). */
export async function GET(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    await requireSuperAdmin();
    if (!getDataSourceDefinition(params.key)) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Unknown data source" } },
        { status: 404 }
      );
    }
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");
    const resolved = await resolveDataSource(params.key, tenantId);
    return NextResponse.json({
      providerKey: params.key,
      configured: Boolean(resolved.secret || resolved.secondary),
      enabled: resolved.enabled,
      source: resolved.source,
    });
  } catch (error: any) {
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

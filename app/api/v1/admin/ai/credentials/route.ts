export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";
import {
  listProviderKeyMatrix,
  normalizeScope,
  removeProviderCredential,
  saveProviderCredential,
  setProviderCredentialEnabled,
} from "@/lib/ai/credentials";

const saveSchema = z.object({
  providerId: z.string().min(1),
  tenantId: z.string().optional().nullable(),
  apiKey: z.string().min(1, "API key or base URL is required"),
});

const toggleSchema = z.object({
  providerId: z.string().min(1),
  tenantId: z.string().optional().nullable(),
  enabled: z.boolean(),
});

async function validateScope(providerId: string, tenantId?: string | null) {
  const provider = await prisma.aIProvider.findUnique({
    where: { id: providerId },
    select: { id: true, providerKey: true, displayName: true },
  });
  if (!provider) return { error: "Provider not found" as const };

  const scope = normalizeScope(tenantId);
  if (scope !== "platform") {
    const tenant = await prisma.tenant.findFirst({
      where: { id: scope, slug: { not: "platform" } },
      select: { id: true, name: true },
    });
    if (!tenant) return { error: "Company not found" as const };
  }
  return { provider, scope };
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const [matrix, providers, modelRows] = await Promise.all([
      listProviderKeyMatrix(),
      prisma.aIProvider.findMany({
        orderBy: [{ enabled: "desc" }, { displayName: "asc" }],
        select: { id: true, providerKey: true, displayName: true, enabled: true },
      }),
      prisma.aIModel.findMany({ select: { providerId: true } }),
    ]);

    const modelCounts = new Map<string, number>();
    for (const row of modelRows) {
      modelCounts.set(row.providerId, (modelCounts.get(row.providerId) ?? 0) + 1);
    }

    return NextResponse.json({
      ...matrix,
      providers: providers.map((p) => ({ ...p, modelCount: modelCounts.get(p.id) ?? 0 })),
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

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const data = saveSchema.parse(await req.json());
    const valid = await validateScope(data.providerId, data.tenantId);
    if (valid.error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: valid.error } },
        { status: 404 }
      );
    }

    await saveProviderCredential(data.providerId, data.apiKey, valid.scope);
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.llm_key_saved",
      category: "config",
      targetType: "ai_provider",
      targetId: data.providerId,
      metadata: {
        providerKey: valid.provider.providerKey,
        scope: valid.scope,
        lastFour: data.apiKey.slice(-4),
      },
    });

    return NextResponse.json({
      ok: true,
      scope: valid.scope,
      masked: `****${data.apiKey.slice(-4)}`,
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

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const data = toggleSchema.parse(await req.json());
    const valid = await validateScope(data.providerId, data.tenantId);
    if (valid.error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: valid.error } },
        { status: 404 }
      );
    }

    const updated = await setProviderCredentialEnabled(
      data.providerId,
      data.enabled,
      valid.scope
    );

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.llm_key_toggled",
      category: "config",
      targetType: "ai_provider",
      targetId: data.providerId,
      metadata: {
        providerKey: valid.provider.providerKey,
        scope: valid.scope,
        enabled: data.enabled,
      },
    });

    return NextResponse.json({ ok: true, enabled: updated.enabled, scope: valid.scope });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No saved key for this scope" } },
        { status: 404 }
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

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get("providerId") ?? "";
    const tenantId = searchParams.get("tenantId");
    if (!providerId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "providerId is required" } },
        { status: 400 }
      );
    }
    const valid = await validateScope(providerId, tenantId);
    if (valid.error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: valid.error } },
        { status: 404 }
      );
    }

    await removeProviderCredential(providerId, valid.scope);
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.llm_key_removed",
      category: "config",
      targetType: "ai_provider",
      targetId: providerId,
      metadata: { providerKey: valid.provider.providerKey, scope: valid.scope },
    });

    return NextResponse.json({ ok: true, scope: valid.scope });
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

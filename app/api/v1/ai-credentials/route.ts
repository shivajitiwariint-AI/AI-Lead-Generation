export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
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
  apiKey: z.string().min(1, "API key or base URL is required"),
});

const toggleSchema = z.object({
  providerId: z.string().min(1),
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
    { error: { code: "FORBIDDEN", message: "Only workspace admins can manage LLM keys" } },
    { status: 403 }
  );
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
  }
  if (!ctx.tenantId) return forbidden();

  try {
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

    const scopeIds = new Set(["platform", ctx.tenantId]);
    const filteredScopes = matrix.scopes.filter((s) => scopeIds.has(s.id));
    const filteredStatuses = matrix.statuses.filter((s) => scopeIds.has(s.scopeId));

    return NextResponse.json({
      scopes: filteredScopes,
      providers: providers.map((p) => ({ ...p, modelCount: modelCounts.get(p.id) ?? 0 })),
      statuses: filteredStatuses,
    });
  } catch (error: any) {
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: error.message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!canManage(ctx)) return forbidden();
  if (!ctx.tenantId) return forbidden();

  try {
    const data = saveSchema.parse(await req.json());
    const provider = await prisma.aIProvider.findUnique({
      where: { id: data.providerId },
      select: { id: true, providerKey: true, displayName: true },
    });
    if (!provider) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Provider not found" } }, { status: 404 });
    }

    await saveProviderCredential(data.providerId, data.apiKey, ctx.tenantId);
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "llm_key_saved",
      category: "config",
      targetType: "ai_provider",
      targetId: data.providerId,
      metadata: { providerKey: provider.providerKey, scope: ctx.tenantId, lastFour: data.apiKey.slice(-4) },
    });

    return NextResponse.json({ ok: true, scope: ctx.tenantId, masked: `****${data.apiKey.slice(-4)}` });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: error.message } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!canManage(ctx)) return forbidden();
  if (!ctx.tenantId) return forbidden();

  try {
    const data = toggleSchema.parse(await req.json());
    const provider = await prisma.aIProvider.findUnique({
      where: { id: data.providerId },
      select: { id: true, providerKey: true, displayName: true },
    });
    if (!provider) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Provider not found" } }, { status: 404 });
    }

    const updated = await setProviderCredentialEnabled(data.providerId, data.enabled, ctx.tenantId);
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "llm_key_toggled",
      category: "config",
      targetType: "ai_provider",
      targetId: data.providerId,
      metadata: { providerKey: provider.providerKey, scope: ctx.tenantId, enabled: data.enabled },
    });
    return NextResponse.json({ ok: true, enabled: updated.enabled });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: error.message } }, { status: 400 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "No saved key for this scope" } }, { status: 404 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: error.message } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!canManage(ctx)) return forbidden();
  if (!ctx.tenantId) return forbidden();

  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("providerId") ?? "";
  if (!providerId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "providerId is required" } }, { status: 400 });
  }

  const provider = await prisma.aIProvider.findUnique({
    where: { id: providerId },
    select: { id: true, providerKey: true, displayName: true },
  });
  if (!provider) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Provider not found" } }, { status: 404 });
  }

  await removeProviderCredential(providerId, ctx.tenantId);
  await recordAudit({
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    actorType: "user",
    action: "llm_key_removed",
    category: "config",
    targetType: "ai_provider",
    targetId: providerId,
    metadata: { providerKey: provider.providerKey, scope: ctx.tenantId },
  });
  return NextResponse.json({ ok: true });
}

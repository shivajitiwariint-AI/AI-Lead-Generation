export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isAITenantEnabled } from "@/lib/ai/settings";
import { recordAudit } from "@/lib/activity";

const putSchema = z.object({
  aiEnabled: z.boolean().optional(),
  models: z.array(z.object({ modelId: z.string(), enabled: z.boolean() })).optional(),
  enableAll: z.boolean().optional(),
  disableAll: z.boolean().optional(),
});

async function requireSuperAdmin(ctx: any) {
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Super admin only" } },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Company not found" } }, { status: 404 });

  const models = await prisma.aIModel.findMany({ orderBy: { displayName: "asc" } });
  const overrides = await prisma.aITenantModel.findMany({ where: { tenantId: params.id } });
  const overrideMap = new Map(overrides.map((o) => [o.modelId, o.enabled]));

  const withProviders = await Promise.all(
    models.map(async (m) => {
      const provider = await prisma.aIProvider.findUnique({ where: { id: m.providerId }, select: { providerKey: true, displayName: true } });
      return {
        id: m.id,
        modelKey: m.modelKey,
        displayName: m.displayName,
        providerKey: provider?.providerKey ?? "",
        providerDisplayName: provider?.displayName ?? "",
        globalEnabled: m.enabled,
        tenantEnabled: overrideMap.has(m.id) ? overrideMap.get(m.id)! : true,
      };
    })
  );

  return NextResponse.json({
    tenantId: params.id,
    aiEnabled: (tenant as any).aiEnabled ?? true,
    tenantAiEnabled: await isAITenantEnabled(params.id),
    models: withProviders,
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  try {
    const body = putSchema.parse(await req.json());
    const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
    if (!tenant) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Company not found" } }, { status: 404 });

    if (body.aiEnabled !== undefined) {
      await prisma.tenant.update({ where: { id: params.id }, data: { aiEnabled: body.aiEnabled } });
    }

    if (body.enableAll || body.disableAll) {
      const enabled = !!body.enableAll;
      const all = await prisma.aIModel.findMany({ select: { id: true } });
      for (const m of all) {
        await prisma.aITenantModel.upsert({
          where: { tenantId_modelId: { tenantId: params.id, modelId: m.id } },
          update: { enabled },
          create: { tenantId: params.id, modelId: m.id, enabled },
        });
      }
    }

    if (body.models) {
      for (const item of body.models) {
        await prisma.aITenantModel.upsert({
          where: { tenantId_modelId: { tenantId: params.id, modelId: item.modelId } },
          update: { enabled: item.enabled },
          create: { tenantId: params.id, modelId: item.modelId, enabled: item.enabled },
        });
      }
    }

    await recordAudit({
      tenantId: null,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.tenant_ai_updated",
      category: "config",
      targetType: "tenant",
      targetId: params.id,
      metadata: { ...body },
    });

    const updated = await prisma.tenant.findUnique({ where: { id: params.id } });
    return NextResponse.json({ ok: true, aiEnabled: (updated as any)?.aiEnabled ?? true });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: err.message } }, { status: 500 });
  }
}

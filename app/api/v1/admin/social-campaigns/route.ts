export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { recordAudit } from "@/lib/activity";

const schema = z.object({
  tenantId: z.string().min(1),
  platform: z.enum(["meta", "linkedin", "instagram"]),
  name: z.string().min(1).max(200),
  externalAccountId: z.string().max(200).optional().nullable(),
  formIds: z.array(z.string().max(200)).max(50).optional(),
  appSecret: z.string().optional().nullable(),
  accessToken: z.string().optional().nullable(),
  verifyToken: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

function decryptOrNull(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const [tenants, rows] = await Promise.all([
      prisma.tenant.findMany({
        where: { slug: { not: "platform" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, status: true },
      }),
      prisma.socialCampaignSource.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    return NextResponse.json({
      companies: tenants,
      configs: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        platform: row.platform,
        name: row.name,
        externalAccountId: row.externalAccountId,
        formIds: row.formIds ?? [],
        appSecretSet: Boolean(row.encryptedAppSecret),
        accessTokenSet: Boolean(row.encryptedAccessToken),
        verifyTokenSet: Boolean(row.encryptedVerifyToken),
        // Shown so an admin can paste it into the platform's webhook settings.
        verifyToken: decryptOrNull(row.encryptedVerifyToken),
        enabled: row.enabled,
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    if (error.message === "Unauthenticated") {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
        { status: 401 }
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

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const data = schema.parse(await req.json());

    const tenant = await prisma.tenant.findFirst({
      where: { id: data.tenantId, slug: { not: "platform" } },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Company not found" } },
        { status: 404 }
      );
    }

    const accountId = data.externalAccountId?.trim() || null;
    const existing = await prisma.socialCampaignSource.findFirst({
      where: {
        tenantId: data.tenantId,
        platform: data.platform,
        externalAccountId: accountId,
      },
    });

    const secrets = {
      encryptedAppSecret: data.appSecret?.trim()
        ? encryptSecret(data.appSecret.trim())
        : existing?.encryptedAppSecret ?? null,
      encryptedAccessToken: data.accessToken?.trim()
        ? encryptSecret(data.accessToken.trim())
        : existing?.encryptedAccessToken ?? null,
      encryptedVerifyToken: data.verifyToken?.trim()
        ? encryptSecret(data.verifyToken.trim())
        : existing?.encryptedVerifyToken ?? null,
    };

    const values = {
      tenantId: data.tenantId,
      platform: data.platform,
      name: data.name.trim(),
      externalAccountId: accountId,
      formIds: (data.formIds ?? []).filter(Boolean) as any,
      ...secrets,
      enabled: data.enabled ?? true,
      updatedAt: new Date(),
    };

    const saved = existing
      ? await prisma.socialCampaignSource.update({
          where: { id: existing.id },
          data: values,
        })
      : await prisma.socialCampaignSource.create({ data: values });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.social_campaign_saved",
      category: "config",
      targetType: "social_campaign_source",
      targetId: saved.id,
      metadata: {
        companyId: data.tenantId,
        platform: data.platform,
        appSecretSet: Boolean(secrets.encryptedAppSecret),
        accessTokenSet: Boolean(secrets.encryptedAccessToken),
        verifyTokenSet: Boolean(secrets.encryptedVerifyToken),
      },
    });

    return NextResponse.json({
      ok: true,
      id: saved.id,
      verifyToken: decryptOrNull(saved.encryptedVerifyToken),
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error.message === "Unauthenticated") {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
        { status: 401 }
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
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "id is required" } },
        { status: 400 }
      );
    }
    const removed = await prisma.socialCampaignSource.deleteMany({ where: { id } });
    if (removed.count === 0) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Configuration not found" } },
        { status: 404 }
      );
    }
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.social_campaign_removed",
      category: "config",
      targetType: "social_campaign_source",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === "Unauthenticated") {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
        { status: 401 }
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

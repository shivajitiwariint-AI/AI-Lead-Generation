export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { REAL_ESTATE_DEFAULTS, getRealEstateConfig } from "@/lib/ai/real-estate";
import { recordAudit } from "@/lib/activity";

const list = z.array(z.string().min(1).max(100)).min(1).max(30);

const bodySchema = z.object({
  tenantId: z.string().optional(),
  config: z.object({
    enabled: z.boolean(),
    propertyTypes: list,
    buyerTypes: list,
    platforms: list,
    keywords: list,
    collectFields: list,
    outreachTone: z.string().min(1).max(200),
    outreachMentions: list,
    outreachRules: list,
    maxResults: z.number().min(1).max(20),
  }),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
  }
  const tenantId = new URL(req.url).searchParams.get("tenantId") ?? ctx.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "tenantId required" } }, { status: 400 });
  }
  if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Cannot view another company's settings" } }, { status: 403 });
  }
  const profile = await prisma.companyProfile.findUnique({ where: { tenantId } });
  return NextResponse.json({ tenantId, config: getRealEstateConfig(profile), defaults: REAL_ESTATE_DEFAULTS });
}

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }, { status: 401 });
  }
  if (!ctx.permissions.includes("settings:write") && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Missing permission: settings:write" } }, { status: 403 });
  }
  try {
    const body = bodySchema.parse(await req.json());
    const tenantId = body.tenantId ?? ctx.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "tenantId required" } }, { status: 400 });
    }
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Cannot edit another company's settings" } }, { status: 403 });
    }
    const existing = await prisma.companyProfile.findUnique({ where: { tenantId } });
    const targetMarket = ((existing?.targetMarket ?? {}) as Record<string, any>) ?? {};
    const nextTarget = { ...targetMarket, realEstate: body.config };
    const profile = await prisma.companyProfile.upsert({
      where: { tenantId },
      create: { tenantId, targetMarket: nextTarget as any },
      update: { targetMarket: nextTarget as any },
    });
    await recordAudit({
      tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "realestate.config_updated",
      category: "config",
      targetType: "company_profile",
      targetId: profile.id,
      metadata: { config: body.config },
    });
    return NextResponse.json({ tenantId, config: getRealEstateConfig(profile) });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: err.message } }, { status: 500 });
  }
}

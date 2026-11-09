export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const profileSchema = z.object({
  industry: z.string().max(100).optional().nullable(),
  website: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  products: z.array(z.record(z.string(), z.any())).optional().nullable(),
  services: z.array(z.record(z.string(), z.any())).optional().nullable(),
  properties: z.array(z.record(z.string(), z.any())).optional().nullable(),
  salesObjectives: z.array(z.record(z.string(), z.any())).optional().nullable(),
  targetMarket: z.record(z.string(), z.any()).optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const profile = await prisma.companyProfile.findUnique({
    where: { tenantId: ctx.tenantId },
  });
  return NextResponse.json({ ...(profile ?? { tenantId: ctx.tenantId }), isSuperAdmin: ctx.isSuperAdmin });
}

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!ctx.permissions.includes("settings:write") && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: settings:write" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const data = profileSchema.parse(body);

    // Never wipe per-country search schedules when onboarding saves targetMarket.
    // If the incoming targetMarket doesn't include searchFrequencies, keep the existing ones.
    let nextTarget = data.targetMarket ?? undefined;
    if (nextTarget && !("searchFrequencies" in nextTarget)) {
      const existing = await prisma.companyProfile.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      const existingFreqs = (existing?.targetMarket as any)?.searchFrequencies;
      if (existingFreqs) {
        nextTarget = { ...nextTarget, searchFrequencies: existingFreqs };
      }
    }
    if (nextTarget) data.targetMarket = nextTarget;

    const profile = await prisma.companyProfile.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        industry: data.industry ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
        products: data.products ?? undefined,
        services: data.services ?? undefined,
        properties: data.properties ?? undefined,
        salesObjectives: data.salesObjectives ?? undefined,
        targetMarket: data.targetMarket ?? undefined,
        onboardingCompleted: data.onboardingCompleted ?? false,
      },
      update: {
        industry: data.industry ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
        products: data.products ?? undefined,
        services: data.services ?? undefined,
        properties: data.properties ?? undefined,
        salesObjectives: data.salesObjectives ?? undefined,
        targetMarket: data.targetMarket ?? undefined,
        ...(data.onboardingCompleted !== undefined
          ? { onboardingCompleted: data.onboardingCompleted }
          : {}),
      },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "company_profile.updated",
      category: "config",
      targetType: "company_profile",
      targetId: profile.id,
      metadata: { industry: profile.industry },
    });

    return NextResponse.json(profile);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: err.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;

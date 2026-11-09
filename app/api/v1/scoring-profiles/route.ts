export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const scoringProfileSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fitScoreWeight: z.number().min(0).max(100).default(30),
  intentScoreWeight: z.number().min(0).max(100).default(25),
  budgetScoreWeight: z.number().min(0).max(100).default(20),
  companyFitWeight: z.number().min(0).max(100).default(15),
  contactCompletenessWeight: z.number().min(0).max(100).default(10),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const profiles = await prisma.scoringProfile.findMany({
    where: { tenantId: ctx.tenantId! },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const data = scoringProfileSchema.parse(body);

    // If this is default, unset other defaults
    if (data.isDefault) {
      await prisma.scoringProfile.updateMany({
        where: { tenantId: ctx.tenantId!, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.scoringProfile.create({
      data: {
        tenantId: ctx.tenantId!,
        name: data.name,
        description: data.description ?? null,
        fitScoreWeight: data.fitScoreWeight,
        intentScoreWeight: data.intentScoreWeight,
        budgetScoreWeight: data.budgetScoreWeight,
        companyFitWeight: data.companyFitWeight,
        contactCompletenessWeight: data.contactCompletenessWeight,
        isDefault: data.isDefault,
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

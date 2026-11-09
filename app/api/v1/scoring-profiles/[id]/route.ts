export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const scoringProfileSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  fitScoreWeight: z.number().min(0).max(100).optional(),
  intentScoreWeight: z.number().min(0).max(100).optional(),
  budgetScoreWeight: z.number().min(0).max(100).optional(),
  companyFitWeight: z.number().min(0).max(100).optional(),
  contactCompletenessWeight: z.number().min(0).max(100).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (data.isDefault) {
      await prisma.scoringProfile.updateMany({
        where: { tenantId: ctx.tenantId!, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.scoringProfile.update({
      where: { id: params.id, tenantId: ctx.tenantId! },
      data,
    });

    return NextResponse.json(profile);
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  await prisma.scoringProfile.delete({
    where: { id: params.id, tenantId: ctx.tenantId! },
  });

  return NextResponse.json({ ok: true });
}

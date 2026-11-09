export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const campaignSchema = z.object({
  name: z.string().min(1),
  objective: z.string().optional(),
  industryId: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  targetAudience: z.string().optional().nullable(),
  locations: z.any().optional(),
  settings: z.any().optional(),
  status: z.string().optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const campaigns = await prisma.campaign.findMany({
    where: { tenantId: ctx.tenantId! },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
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
    const data = campaignSchema.parse(body);

    const campaign = await prisma.campaign.create({
      data: {
        tenantId: ctx.tenantId!,
        name: data.name,
        objective: data.objective ?? null,
        industryId: data.industryId ?? null,
        category: data.category ?? null,
        targetAudience: data.targetAudience ?? null,
        locations: data.locations ?? null,
        settings: data.settings ?? null,
        status: data.status ?? "draft",
      },
    });

    return NextResponse.json(campaign, { status: 201 });
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

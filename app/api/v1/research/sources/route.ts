export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const sourceSchema = z.object({
  name: z.string().min(1).max(200),
  sourceType: z.enum(["directory", "search", "website", "social", "api"]),
  url: z.string().max(500).optional().nullable(),
  approved: z.boolean().optional(),
  config: z.record(z.string(), z.any()).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const sources = await prisma.researchSource.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  try {
    const body = await req.json();
    const data = sourceSchema.parse(body);
    const source = await prisma.researchSource.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        sourceType: data.sourceType,
        url: data.url ?? null,
        approved: data.approved ?? true,
        config: (data.config ?? undefined) as any,
      },
    });
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "research.source_created",
      category: "research",
      targetType: "research_source",
      targetId: source.id,
      metadata: { name: source.name, sourceType: source.sourceType, approved: source.approved },
    });
    return NextResponse.json(source, { status: 201 });
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

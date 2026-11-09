export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const templateSchema = z.object({
  campaignId: z.string().optional().nullable(),
  channel: z.enum(["email", "whatsapp"]),
  name: z.string().min(1),
  content: z.string().min(1),
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

  const templates = await prisma.messageTemplate.findMany({
    where: { tenantId: ctx.tenantId! },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
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
    const data = templateSchema.parse(body);

    const template = await prisma.messageTemplate.create({
      data: {
        tenantId: ctx.tenantId!,
        campaignId: data.campaignId ?? null,
        channel: data.channel,
        name: data.name,
        content: data.content,
        status: data.status ?? "draft",
      },
    });

    return NextResponse.json(template, { status: 201 });
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

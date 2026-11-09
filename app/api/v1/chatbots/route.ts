export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const chatbotSchema = z.object({
  name: z.string().min(1),
  settings: z.record(z.string(), z.any()).optional(),
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

  const chatbots = await prisma.chatbot.findMany({
    where: { tenantId: ctx.tenantId! },
    orderBy: { createdAt: "desc" },
  });

  const counts = chatbots.length
    ? await prisma.conversation.groupBy({
        by: ["chatbotId"],
        where: { tenantId: ctx.tenantId!, chatbotId: { in: chatbots.map((b) => b.id) } },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map(counts.map((c: any) => [c.chatbotId, c._count._all]));

  return NextResponse.json(
    chatbots.map((b) => ({ ...b, _count: { conversations: countMap.get(b.id) ?? 0 } }))
  );
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
    const data = chatbotSchema.parse(body);

    const chatbot = await prisma.chatbot.create({
      data: {
        tenantId: ctx.tenantId!,
        name: data.name,
        publicKey: `pk_${Math.random().toString(36).substring(2, 18)}`,
        settings: data.settings ?? {},
        status: data.status ?? "active",
      },
    });

    return NextResponse.json(chatbot, { status: 201 });
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

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const updateChatbotSchema = z.object({
  name: z.string().min(1).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  status: z.string().optional(),
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
    const data = updateChatbotSchema.parse(body);

    const chatbot = await prisma.chatbot.update({
      where: { id: params.id, tenantId: ctx.tenantId! },
      data,
    });

    return NextResponse.json(chatbot);
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

  await prisma.chatbot.delete({
    where: { id: params.id, tenantId: ctx.tenantId! },
  });

  return NextResponse.json({ ok: true });
}

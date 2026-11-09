export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const messageSchema = z.object({
  leadId: z.string().optional().nullable(),
  conversationId: z.string().optional().nullable(),
  channel: z.enum(["email", "whatsapp"]),
  providerId: z.string().optional().nullable(),
  status: z.string().optional(),
  approvedBy: z.string().optional().nullable(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const messages = await prisma.message.findMany({
    where: { tenantId: ctx.tenantId! },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(messages);
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
    const data = messageSchema.parse(body);

    // Default to draft - requires approval before sending
    const message = await prisma.message.create({
      data: {
        tenantId: ctx.tenantId!,
        leadId: data.leadId ?? null,
        conversationId: data.conversationId ?? null,
        channel: data.channel,
        providerId: data.providerId ?? null,
        status: "draft",
        approvedBy: data.approvedBy ?? null,
      },
    });

    return NextResponse.json(message, { status: 201 });
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

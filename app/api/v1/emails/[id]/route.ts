export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const editSchema = z.object({
  subject: z.string().max(500).optional(),
  body: z.string().max(20000).optional(),
  toAddress: z.string().email().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const message = await prisma.message.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
  });
  if (!message) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Email not found" } },
      { status: 404 }
    );
  }
  return NextResponse.json(message);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  try {
    const body = await req.json();
    const data = editSchema.parse(body);
    const existing = await prisma.message.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Email not found" } },
        { status: 404 }
      );
    }
    if (existing.status === "sent") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Cannot edit a sent email" } },
        { status: 409 }
      );
    }
    const updated = await prisma.message.update({
      where: { id: params.id },
      data: {
        subject: data.subject ?? existing.subject,
        body: data.body ?? existing.body,
        toAddress: data.toAddress ?? existing.toAddress,
        status: existing.status === "approved" ? "approved" : "draft",
      },
    });
    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "email.edited",
      category: "email",
      targetType: "message",
      targetId: params.id,
      metadata: { fields: Object.keys(data) },
    });
    return NextResponse.json(updated);
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

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const patchSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  keywords: z.array(z.string().min(1).max(50)).min(1).max(30).optional(),
  content: z.string().min(50).max(5000).optional(),
  enabled: z.boolean().optional(),
});

async function requireSuperAdmin(ctx: any) {
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Super admin only" } },
      { status: 403 }
    );
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  try {
    const data = patchSchema.parse(await req.json());
    const existing = await prisma.publicDoc.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Doc not found" } },
        { status: 404 }
      );
    }
    const doc = await prisma.publicDoc.update({
      where: { id: params.id },
      data: data as any,
    });
    await recordAudit({
      tenantId: null,
      actorId: ctx.userId,
      actorType: "user",
      action: "public_doc.updated",
      category: "config",
      targetType: "public_doc",
      targetId: doc.id,
      metadata: { title: doc.title, enabled: doc.enabled },
    });
    return NextResponse.json(doc);
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  const existing = await prisma.publicDoc.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Doc not found" } },
      { status: 404 }
    );
  }
  await prisma.publicDoc.delete({ where: { id: params.id } });
  await recordAudit({
    tenantId: null,
    actorId: ctx.userId,
    actorType: "user",
    action: "public_doc.deleted",
    category: "config",
    targetType: "public_doc",
    targetId: params.id,
    metadata: { title: existing.title },
  });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";
import { PUBLIC_DOCS } from "@/lib/public-knowledge";

const createSchema = z.object({
  title: z.string().min(3).max(200),
  keywords: z.array(z.string().min(1).max(50)).min(1).max(30).default([]),
  content: z.string().min(50).max(5000),
  enabled: z.boolean().default(true),
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

export async function GET() {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  // Seed the table once from the approved static list so admins start with content
  const count = await prisma.publicDoc.count();
  if (count === 0) {
    await prisma.publicDoc.createMany({
      data: PUBLIC_DOCS.map((d) => ({
        title: d.title,
        keywords: d.keywords as any,
        content: d.content,
        enabled: true,
      })),
    });
  }

  const docs = await prisma.publicDoc.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ data: docs });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  try {
    const data = createSchema.parse(await req.json());
    const doc = await prisma.publicDoc.create({ data: data as any });
    await recordAudit({
      tenantId: null,
      actorId: ctx.userId,
      actorType: "user",
      action: "public_doc.created",
      category: "config",
      targetType: "public_doc",
      targetId: doc.id,
      metadata: { title: doc.title },
    });
    return NextResponse.json(doc, { status: 201 });
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

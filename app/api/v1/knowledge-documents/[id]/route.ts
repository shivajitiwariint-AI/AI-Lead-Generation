export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// Only metadata can be edited; document text is chunked once and immutable.
const patchSchema = z.object({
  status: z.string().max(50).optional(),
  fileRef: z.string().min(1).max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { id: params.id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Document not found" } },
        { status: 404 }
      );
    }

    const document = await prisma.knowledgeDocument.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(document);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.issues?.[0]?.message ?? error.message } },
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
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const [deleted] = await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({
      where: { documentId: params.id, tenantId: ctx.tenantId },
    }),
    prisma.knowledgeDocument.deleteMany({
      where: { id: params.id, tenantId: ctx.tenantId },
    }),
  ]);

  if (deleted.count === 0) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Document not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

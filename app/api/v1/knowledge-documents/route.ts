export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const documentSchema = z.object({
  chatbotId: z.string(),
  fileRef: z.string(),
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

  const documents = await prisma.knowledgeDocument.findMany({
    where: { tenantId: ctx.tenantId! },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
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
    const data = documentSchema.parse(body);

    const document = await prisma.knowledgeDocument.create({
      data: {
        tenantId: ctx.tenantId!,
        chatbotId: data.chatbotId,
        fileRef: data.fileRef,
        status: data.status ?? "processing",
      },
    });

    // Queue document ingestion job
    await prisma.automationJob.create({
      data: {
        tenantId: ctx.tenantId!,
        jobType: "document.ingest",
        status: "pending",
        runAt: new Date(),
        payload: JSON.stringify({ documentId: document.id }),
      },
    });

    return NextResponse.json(document, { status: 201 });
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

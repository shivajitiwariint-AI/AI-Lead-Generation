export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const documentSchema = z
  .object({
    chatbotId: z.string().min(1),
    title: z.string().max(500).optional(),
    fileRef: z.string().max(500).optional(),
    content: z.string().max(200_000).optional(),
    status: z.string().max(50).optional(),
  })
  .refine((d) => Boolean(d.content?.trim()) || Boolean(d.fileRef?.trim()), {
    message: "Provide document text or a file reference",
  });

/** Split pasted text into RAG-sized chunks (paragraph aware). */
function chunkText(input: string, size = 1200, maxChunks = 500): string[] {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const raw of text.split(/\n{2,}/)) {
    let p = raw.trim();
    if (!p) continue;
    // Break extremely long paragraphs so a single chunk stays readable.
    while (p.length > size) {
      flush();
      chunks.push(p.slice(0, size));
      p = p.slice(size);
    }
    if (current && current.length + 2 + p.length > size) flush();
    current = current ? `${current}\n\n${p}` : p;
  }
  flush();
  return chunks.slice(0, maxChunks);
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const documents = await prisma.knowledgeDocument.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "desc" },
  });

  const counts = documents.length
    ? await prisma.knowledgeChunk.groupBy({
        by: ["documentId"],
        where: { tenantId: ctx.tenantId, documentId: { in: documents.map((d) => d.id) } },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map(counts.map((c) => [c.documentId, c._count._all]));

  return NextResponse.json(
    documents.map((d) => ({ ...d, chunkCount: countMap.get(d.id) ?? 0 }))
  );
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
    const data = documentSchema.parse(body);

    const chatbot = await prisma.chatbot.findFirst({
      where: { id: data.chatbotId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!chatbot) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Chatbot not found in this workspace" } },
        { status: 404 }
      );
    }

    const content = data.content?.trim() ?? "";
    const chunks = chunkText(content);
    const fileRef = data.title?.trim() || data.fileRef?.trim() || "Untitled document";

    const document = await prisma.knowledgeDocument.create({
      data: {
        tenantId: ctx.tenantId,
        chatbotId: data.chatbotId,
        fileRef,
        status: content ? (chunks.length ? "completed" : "empty") : data.status ?? "reference",
      },
    });

    if (chunks.length > 0) {
      await prisma.knowledgeChunk.createMany({
        data: chunks.map((chunk, index) => ({
          tenantId: ctx.tenantId!,
          documentId: document.id,
          chunkIndex: index,
          content: chunk,
        })),
      });
    }

    return NextResponse.json({ ...document, chunkCount: chunks.length });
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

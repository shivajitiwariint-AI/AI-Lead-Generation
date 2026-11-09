export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const MODULE_KEYS = [
  "chatbot",
  "lead_extraction",
  "lead_qualification",
  "company_research",
  "complex_analysis",
  "email_drafting",
  "conversation_summary",
  "embeddings",
] as const;

/**
 * Apply the environment-backed defaults to every AI module:
 * Groq as primary (GROQ_API_KEY) and Ollama as fallback (OLLAMA_BASE_URL).
 */
export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await req.json().catch(() => ({}));
    const scope =
      typeof body?.tenantId === "string" && body.tenantId
        ? body.tenantId
        : "platform";

    const [groq, ollama] = await Promise.all([
      prisma.aIProvider.findUnique({ where: { providerKey: "groq" } }),
      prisma.aIProvider.findUnique({ where: { providerKey: "ollama" } }),
    ]);

    if (!groq || !groq.enabled) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "Groq provider is missing or disabled" } },
        { status: 400 }
      );
    }
    if (!ollama || !ollama.enabled) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "Ollama provider is missing or disabled" } },
        { status: 400 }
      );
    }

    const [groqModels, ollamaModels] = await Promise.all([
      prisma.aIModel.findMany({
        where: { providerId: groq.id, enabled: true },
        orderBy: { displayName: "asc" },
      }),
      prisma.aIModel.findMany({
        where: { providerId: ollama.id, enabled: true },
        orderBy: { displayName: "asc" },
      }),
    ]);

    const primary =
      groqModels.find((m) => m.modelKey === "openai/gpt-oss-120b") ??
      groqModels[0];
    const fallback =
      ollamaModels.find((m) => m.modelKey === "qwen3:8b") ??
      ollamaModels.find((m) => m.modelKey === "llama3.2:latest") ??
      ollamaModels[0];

    if (!primary) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "No enabled Groq model found" } },
        { status: 400 }
      );
    }
    if (!fallback) {
      return NextResponse.json(
        { error: { code: "NOT_CONFIGURED", message: "No enabled Ollama model found" } },
        { status: 400 }
      );
    }

    for (const moduleKey of MODULE_KEYS) {
      await prisma.aIModuleAssignment.upsert({
        where: {
          tenantId_moduleKey: { tenantId: scope, moduleKey },
        },
        update: {
          modelId: primary.id,
          fallbackModelId: fallback.id,
          updatedAt: new Date(),
        },
        create: {
          tenantId: scope,
          moduleKey,
          modelId: primary.id,
          fallbackModelId: fallback.id,
        },
      });
    }

    return NextResponse.json({
      scope,
      primary: {
        id: primary.id,
        provider: groq.displayName,
        modelKey: primary.modelKey,
        displayName: primary.displayName,
      },
      fallback: {
        id: fallback.id,
        provider: ollama.displayName,
        modelKey: fallback.modelKey,
        displayName: fallback.displayName,
      },
      modules: MODULE_KEYS,
    });
  } catch (error: any) {
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

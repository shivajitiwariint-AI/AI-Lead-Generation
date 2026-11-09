export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const providerSchema = z.object({
  providerKey: z.enum([
    "anthropic",
    "google_gemini",
    "xai_grok",
    "ollama",
    "openai",
  ]),
  displayName: z.string().min(1),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const ctx = await requireSuperAdmin();
    const providers = await prisma.aIProvider.findMany({
      orderBy: [{ displayName: "asc" }],
    });

    // Fetch models and credentials separately for each provider
    const providersWithDetails = await Promise.all(
      providers.map(async (provider) => {
        const models = await prisma.aIModel.findMany({
          where: { providerId: provider.id, enabled: true },
          select: {
            id: true,
            modelKey: true,
            displayName: true,
            enabled: true,
          },
        });
        const credentials = await prisma.aICredential.findMany({
          where: { providerId: provider.id },
          select: { id: true },
        });
        return {
          ...provider,
          models,
          _count: { credentials: credentials.length },
        };
      })
    );

    return NextResponse.json(providersWithDetails);
  } catch (error: any) {
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    if (error.message === "Unauthenticated") {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();
    const body = await req.json();
    const data = providerSchema.parse(body);

    const existing = await prisma.aIProvider.findUnique({
      where: { providerKey: data.providerKey },
    });
    if (existing) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "Provider already exists" } },
        { status: 409 }
      );
    }

    const provider = await prisma.aIProvider.create({
      data: {
        providerKey: data.providerKey,
        displayName: data.displayName,
        enabled: data.enabled,
      },
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
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

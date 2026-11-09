export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const modelSchema = z.object({
  providerId: z.string(),
  modelKey: z.string().min(1),
  displayName: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireSuperAdmin();

    const models = await prisma.aIModel.findMany({
      orderBy: [{ displayName: "asc" }],
    });

    // Fetch provider details separately
    const modelsWithProviders = await Promise.all(
      models.map(async (model) => {
        const provider = await prisma.aIProvider.findUnique({
          where: { id: model.providerId },
          select: {
            id: true,
            providerKey: true,
            displayName: true,
            enabled: true,
          },
        });
        return {
          ...model,
          provider,
        };
      })
    );

    return NextResponse.json(modelsWithProviders);
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

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const data = modelSchema.parse(body);

    const provider = await prisma.aIProvider.findUnique({
      where: { id: data.providerId },
    });
    if (!provider) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Provider not found" } },
        { status: 404 }
      );
    }

    const model = await prisma.aIModel.create({
      data: {
        providerId: data.providerId,
        modelKey: data.modelKey,
        displayName: data.displayName,
        capabilities: data.capabilities ?? [],
        enabled: data.enabled,
      },
    });

    return NextResponse.json(model, { status: 201 });
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

const bulkSchema = z.object({
  enabled: z.boolean(),
  // optional: only toggle one provider's models (e.g. "groq")
  providerKey: z.string().optional(),
});

export async function PUT(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const { enabled, providerKey } = bulkSchema.parse(await req.json());

    let where: any = {};
    if (providerKey) {
      const provider = await prisma.aIProvider.findUnique({ where: { providerKey } });
      if (!provider) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Provider not found" } },
          { status: 404 }
        );
      }
      where = { providerId: provider.id };
    }

    const result = await prisma.aIModel.updateMany({ where, data: { enabled } });
    return NextResponse.json({ ok: true, enabled, updated: result.count });
  } catch (error: any) {
    if (error?.name === "ZodError") {
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

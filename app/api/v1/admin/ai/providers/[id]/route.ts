export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { normalizeScope, saveProviderCredential } from "@/lib/ai/credentials";
import { recordAudit } from "@/lib/activity";

const updateProviderSchema = z.object({
  displayName: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const credentialSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  tenantId: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const data = updateProviderSchema.parse(body);

    const provider = await prisma.aIProvider.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(provider);
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await requireSuperAdmin();
    const body = await req.json();
    const data = credentialSchema.parse(body);

    const provider = await prisma.aIProvider.findUnique({
      where: { id: params.id },
    });
    if (!provider) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Provider not found" } },
        { status: 404 }
      );
    }

    const scope = normalizeScope(data.tenantId);
    await saveProviderCredential(params.id, data.apiKey, scope);

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.llm_key_saved",
      category: "config",
      targetType: "ai_provider",
      targetId: params.id,
      metadata: { providerKey: provider.providerKey, scope, lastFour: data.apiKey.slice(-4) },
    });

    return NextResponse.json({
      ok: true,
      scope,
      masked: `****${data.apiKey.slice(-4)}`,
    });
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();

    await prisma.aIProvider.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
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

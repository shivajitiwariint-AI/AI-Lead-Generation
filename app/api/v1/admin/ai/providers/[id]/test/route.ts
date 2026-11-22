export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { testProviderConnection } from "@/lib/ai-gateway";
import { normalizeScope } from "@/lib/ai/credentials";

const testSchema = z.object({
  tenantId: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();

    const provider = await prisma.aIProvider.findUnique({
      where: { id: params.id },
    });
    if (!provider) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Provider not found" } },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const data = testSchema.parse(body);
    const scope = normalizeScope(data.tenantId);

    const result = await testProviderConnection(
      params.id,
      scope === "platform" ? undefined : scope
    );

    // Record the test attempt for audit/usage
    await prisma.aIUsageLog.create({
      data: {
        tenantId: scope,
        providerId: provider.id,
        modelId: "",
        inputTokens: 0,
        outputTokens: 0,
        requestId: `test-${Date.now()}`,
      },
    });

    return NextResponse.json({
      providerId: provider.id,
      providerKey: provider.providerKey,
      scope,
      success: result.success,
      latency: result.latency,
      error: result.error,
      model: result.model,
      testedAt: new Date(),
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

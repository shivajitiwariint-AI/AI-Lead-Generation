export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { testProviderConnection } from "@/lib/ai-gateway";

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

    const result = await testProviderConnection(params.id);

    // Record the test attempt for audit/usage
    await prisma.aIUsageLog.create({
      data: {
        tenantId: "platform",
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
      success: result.success,
      latency: result.latency,
      error: result.error,
      model: result.model,
      testedAt: new Date(),
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

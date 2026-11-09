export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { testModelConnection } from "@/lib/ai-gateway";

/**
 * Test a single AI model with a minimal real request.
 * Used by the per-row "Test" action on the AI Models page.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();

    const model = await prisma.aIModel.findUnique({
      where: { id: params.id },
    });
    if (!model) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Model not found" } },
        { status: 404 }
      );
    }

    const result = await testModelConnection(params.id);

    return NextResponse.json({
      modelId: model.id,
      modelKey: model.modelKey,
      displayName: model.displayName,
      checkedAt: new Date().toISOString(),
      ...result,
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

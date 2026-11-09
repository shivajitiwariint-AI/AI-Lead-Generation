export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();
    const { enabled } = patchSchema.parse(await req.json());

    const existing = await prisma.aIModel.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Model not found" } },
        { status: 404 }
      );
    }

    const model = await prisma.aIModel.update({
      where: { id: params.id },
      data: { enabled },
    });

    return NextResponse.json(model);
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

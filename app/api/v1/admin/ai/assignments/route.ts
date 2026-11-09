export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const assignmentSchema = z.object({
  assignments: z.array(
    z.object({
      moduleKey: z.string(),
      modelId: z.string(),
      fallbackModelId: z.string().optional().nullable(),
      tenantId: z.string().optional().nullable(),
    })
  ),
});

export async function GET() {
  try {
    const ctx = await requireSuperAdmin();

    const assignments = await prisma.aIModuleAssignment.findMany({
      orderBy: [{ moduleKey: "asc" }],
    });

    // Fetch model and provider details separately
    const assignmentsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const model = await prisma.aIModel.findUnique({
          where: { id: assignment.modelId },
        });
        const provider = model
          ? await prisma.aIProvider.findUnique({
              where: { id: model.providerId },
              select: { providerKey: true, displayName: true },
            })
          : null;
        const fallbackModel = assignment.fallbackModelId
          ? await prisma.aIModel.findUnique({
              where: { id: assignment.fallbackModelId },
              select: {
                id: true,
                modelKey: true,
                displayName: true,
                providerId: true,
              },
            })
          : null;
        const fallbackProvider = fallbackModel
          ? await prisma.aIProvider.findUnique({
              where: { id: fallbackModel.providerId },
              select: { providerKey: true, displayName: true },
            })
          : null;

        return {
          ...assignment,
          model: model
            ? {
                id: model.id,
                modelKey: model.modelKey,
                displayName: model.displayName,
                providerKey: provider?.providerKey ?? "",
                providerDisplayName: provider?.displayName ?? "",
              }
            : null,
          fallbackModel: fallbackModel
            ? {
                id: fallbackModel.id,
                modelKey: fallbackModel.modelKey,
                displayName: fallbackModel.displayName,
                providerKey: fallbackProvider?.providerKey ?? "",
                providerDisplayName: fallbackProvider?.displayName ?? "",
              }
            : null,
        };
      })
    );

    return NextResponse.json(assignmentsWithDetails);
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

export async function PUT(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const data = assignmentSchema.parse(body);

    const results = [];
    for (const a of data.assignments) {
      const result = await prisma.aIModuleAssignment.upsert({
        where: {
          tenantId_moduleKey: {
            tenantId: a.tenantId ?? "platform",
            moduleKey: a.moduleKey,
          },
        },
        update: {
          modelId: a.modelId,
          fallbackModelId: a.fallbackModelId ?? null,
          updatedAt: new Date(),
        },
        create: {
          tenantId: a.tenantId ?? "platform",
          moduleKey: a.moduleKey,
          modelId: a.modelId,
          fallbackModelId: a.fallbackModelId ?? null,
        },
      });
      results.push(result);
    }

    return NextResponse.json(results);
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

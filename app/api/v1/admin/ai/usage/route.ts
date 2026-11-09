export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || undefined;
    const providerId = searchParams.get("providerId") || undefined;
    const modelId = searchParams.get("modelId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (providerId) where.providerId = providerId;
    if (modelId) where.modelId = modelId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const usageLogs = await prisma.aIUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Fetch provider and model details separately
    const usageWithDetails = await Promise.all(
      usageLogs.map(async (log) => {
        const provider = log.providerId
          ? await prisma.aIProvider
              .findUnique({
                where: { id: log.providerId },
                select: { providerKey: true, displayName: true },
              })
              .catch(() => null)
          : null;
        const model = log.modelId
          ? await prisma.aIModel
              .findUnique({
                where: { id: log.modelId },
                select: { modelKey: true, displayName: true },
              })
              .catch(() => null)
          : null;
        return {
          ...log,
          provider,
          model,
        };
      })
    );

    const totalInputTokens = usageLogs.reduce(
      (sum, log) => sum + log.inputTokens,
      0
    );
    const totalOutputTokens = usageLogs.reduce(
      (sum, log) => sum + log.outputTokens,
      0
    );

    const costWhere: any = {};
    if (tenantId) costWhere.tenantId = tenantId;
    if (providerId) costWhere.providerId = providerId;
    if (modelId) costWhere.modelId = modelId;
    if (startDate || endDate) {
      costWhere.createdAt = {};
      if (startDate) costWhere.createdAt.gte = new Date(startDate);
      if (endDate) costWhere.createdAt.lte = new Date(endDate);
    }

    const costLogs = await prisma.aICostLog.findMany({
      where: costWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const totalEstimatedCost = costLogs.reduce(
      (sum, log) => sum + Number(log.estimatedCost),
      0
    );

    return NextResponse.json({
      usage: usageWithDetails,
      costs: costLogs,
      summary: {
        totalInputTokens,
        totalOutputTokens,
        totalEstimatedCost,
        totalRequests: usageLogs.length,
      },
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

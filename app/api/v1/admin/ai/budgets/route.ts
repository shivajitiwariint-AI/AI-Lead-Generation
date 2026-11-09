export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { checkBudget } from "@/lib/ai-gateway";
import { recordAudit } from "@/lib/activity";

const budgetSchema = z.object({
  tenantId: z.string().optional(), // null/omitted = platform-wide (super admin)
  monthlyTokenLimit: z.number().int().min(1).optional().nullable(),
  monthlyCostLimit: z.number().min(0).optional().nullable(),
  alertThreshold: z.number().min(0).max(1).optional(),
  enforce: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") || undefined;

  const rows = await prisma.aIBudget.findMany({
    where: tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {},
    orderBy: { tenantId: "desc" },
  });
  // status for the requested tenant
  let status = null;
  if (tenantId) status = await checkBudget(tenantId);
  return NextResponse.json({ budgets: rows, status });
}

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!ctx.isSuperAdmin && !ctx.permissions.includes("settings:write")) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const data = budgetSchema.parse(body);
    const targetTenantId = data.tenantId ?? null;

    // Only super admins can set platform-wide budgets
    if (targetTenantId === null && !ctx.isSuperAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only super admins can set platform budgets" } },
        { status: 403 }
      );
    }

    const existing = await prisma.aIBudget.findFirst({
      where: { tenantId: targetTenantId },
    });
    const saved = existing
      ? await prisma.aIBudget.update({
          where: { id: existing.id },
          data: {
            monthlyTokenLimit: data.monthlyTokenLimit ?? existing.monthlyTokenLimit,
            monthlyCostLimit: data.monthlyCostLimit ?? existing.monthlyCostLimit,
            alertThreshold: data.alertThreshold ?? existing.alertThreshold,
            enforce: data.enforce ?? existing.enforce,
          },
        })
      : await prisma.aIBudget.create({
          data: {
            tenantId: targetTenantId,
            monthlyTokenLimit: data.monthlyTokenLimit ?? null,
            monthlyCostLimit: data.monthlyCostLimit ?? null,
            alertThreshold: data.alertThreshold ?? 0.8,
            enforce: data.enforce ?? false,
          },
        });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "ai.budget.updated",
      category: "config",
      targetType: "ai_budget",
      targetId: saved.id,
      metadata: { targetTenantId, enforce: saved.enforce },
    });

    return NextResponse.json(saved);
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: err.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

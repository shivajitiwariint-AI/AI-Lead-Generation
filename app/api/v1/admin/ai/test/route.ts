export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { checkBudget, testModelConnection, type ModelTestResult } from "@/lib/ai-gateway";
import { checkSharedRateLimit } from "@/lib/rate-limit";

const MODULE_KEYS = [
  "chatbot",
  "lead_extraction",
  "lead_qualification",
  "company_research",
  "complex_analysis",
  "email_drafting",
  "conversation_summary",
  "embeddings",
] as const;

const testSchema = z.object({
  tenantId: z.string().optional().nullable(),
  moduleKey: z.string().optional(),
  // Subset of modules to test. Used by "Test AI setup" to skip modules that
  // already have a result and avoid spending tokens twice.
  moduleKeys: z.array(z.string()).min(1).optional(),
});

interface ModelRef {
  id: string;
  modelKey: string;
  displayName: string;
  providerKey: string;
  providerDisplayName: string;
  enabled: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin();

    const rl = await checkSharedRateLimit([`ai-test:${ctx.userId}`], 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMIT", message: "Too many AI tests — wait a minute and try again." } },
        { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const data = testSchema.parse(body);
    const scope = data.tenantId ?? "platform";

    const requestedKeys = data.moduleKey
      ? [data.moduleKey]
      : data.moduleKeys ?? [...MODULE_KEYS];
    const moduleKeys = MODULE_KEYS.filter((k) => requestedKeys.includes(k));
    if (moduleKeys.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "No valid module keys were provided",
          },
        },
        { status: 400 }
      );
    }

    // Scope-specific assignment wins; otherwise fall back to the platform default.
    const allAssignments = await prisma.aIModuleAssignment.findMany({
      where: {
        moduleKey: { in: moduleKeys },
        OR: [{ tenantId: scope }, { tenantId: "platform" }, { tenantId: null }],
      },
    });

    const selected = moduleKeys.map((moduleKey) => {
      const scoped = allAssignments.find(
        (a) => a.moduleKey === moduleKey && a.tenantId === scope
      );
      const platform = allAssignments.find(
        (a) =>
          a.moduleKey === moduleKey &&
          (a.tenantId === "platform" || a.tenantId === null)
      );
      return { moduleKey, assignment: scoped ?? platform ?? null };
    });

    const modelIds = new Set<string>();
    for (const { assignment } of selected) {
      if (assignment) {
        modelIds.add(assignment.modelId);
        if (assignment.fallbackModelId) modelIds.add(assignment.fallbackModelId);
      }
    }

    const models = await prisma.aIModel.findMany({
      where: { id: { in: Array.from(modelIds) } },
    });
    const providers = await prisma.aIProvider.findMany();
    const modelById = new Map(models.map((m) => [m.id, m]));
    const providerById = new Map(providers.map((p) => [p.id, p]));

    const modelRef = (id: string | null | undefined): ModelRef | null => {
      if (!id) return null;
      const model = modelById.get(id);
      if (!model) return null;
      const provider = providerById.get(model.providerId);
      if (!provider) return null;
      return {
        id: model.id,
        modelKey: model.modelKey,
        displayName: model.displayName,
        providerKey: provider.providerKey,
        providerDisplayName: provider.displayName,
        enabled: model.enabled && provider.enabled,
      };
    };

    // Deduplicate provider calls: several modules can share the same model.
    const uniqueModelIds = Array.from(modelIds).filter((id) => modelById.has(id));
    const testResults = new Map<string, ModelTestResult>();
    await Promise.all(
      uniqueModelIds.map(async (id) => {
        testResults.set(
          id,
          await testModelConnection(id, scope === "platform" ? undefined : scope)
        );
      })
    );

    const modules = selected.map(({ moduleKey, assignment }) => {
      const primary = assignment ? modelRef(assignment.modelId) : null;
      const fallback = assignment?.fallbackModelId
        ? modelRef(assignment.fallbackModelId)
        : null;

      if (!assignment) {
        return {
          moduleKey,
          status: "unassigned" as const,
          primary: null,
          fallback: null,
          usedModel: null,
          error: "No model assigned to this module",
        };
      }

      const primaryResult = modelById.has(assignment.modelId)
        ? testResults.get(assignment.modelId)
        : { success: false, latency: 0, error: "Assigned model no longer exists" };
      const fallbackResult = assignment.fallbackModelId && modelById.has(assignment.fallbackModelId)
        ? testResults.get(assignment.fallbackModelId)
        : undefined;

      if (primaryResult?.success) {
        return {
          moduleKey,
          status: "working" as const,
          primary,
          fallback,
          usedModel: primary,
          latencyMs: primaryResult.latency,
          inputTokens: primaryResult.inputTokens ?? 0,
          outputTokens: primaryResult.outputTokens ?? 0,
          sample: primaryResult.text,
        };
      }

      if (fallbackResult?.success) {
        return {
          moduleKey,
          status: "fallback" as const,
          primary,
          fallback,
          usedModel: fallback,
          latencyMs: fallbackResult.latency,
          inputTokens: fallbackResult.inputTokens ?? 0,
          outputTokens: fallbackResult.outputTokens ?? 0,
          sample: fallbackResult.text,
          error: primaryResult?.error,
        };
      }

      return {
        moduleKey,
        status: "failed" as const,
        primary,
        fallback,
        usedModel: null,
        latencyMs: primaryResult?.latency,
        error:
          primaryResult?.error ??
          fallbackResult?.error ??
          "Model test failed",
      };
    });

    const budget = await checkBudget(scope);
    const remainingTokens =
      budget.tokenLimit != null
        ? Math.max(0, budget.tokenLimit - budget.currentMonthTokens)
        : null;
    const remainingCost =
      budget.budgetLimit != null
        ? Math.max(0, budget.budgetLimit - budget.currentMonthCost)
        : null;

    return NextResponse.json({
      scope,
      checkedAt: new Date().toISOString(),
      budget: {
        ...budget,
        remainingTokens,
        remainingCost,
        canRun: !budget.enforce || budget.withinBudget,
      },
      summary: {
        total: modules.length,
        working: modules.filter((m) => m.status === "working").length,
        fallback: modules.filter((m) => m.status === "fallback").length,
        failed: modules.filter((m) => m.status === "failed").length,
        unassigned: modules.filter((m) => m.status === "unassigned").length,
      },
      modules,
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

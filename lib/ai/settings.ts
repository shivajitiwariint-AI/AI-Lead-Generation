import { prisma } from "@/lib/prisma";

export async function isAIEnabled(): Promise<boolean> {
  try {
    const row = await prisma.aISettings.findUnique({ where: { id: "global" } });
    if (!row) return true;
    return row.aiEnabled;
  } catch {
    return true;
  }
}

export async function setAIEnabled(enabled: boolean, updatedBy?: string) {
  return prisma.aISettings.upsert({
    where: { id: "global" },
    create: { id: "global", aiEnabled: enabled, updatedBy: updatedBy ?? null },
    update: { aiEnabled: enabled, updatedBy: updatedBy ?? null },
  });
}

/** Per-tenant master switch (company can turn AI off independently). */
export async function isAITenantEnabled(tenantId?: string | null): Promise<boolean> {
  if (!tenantId) return true;
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { aiEnabled: true } });
    if (!tenant) return true;
    return tenant.aiEnabled !== false;
  } catch {
    return true;
  }
}

/** Whether this tenant may use this model (tenant override wins, else global model.enabled). */
export async function isModelEnabledForTenant(
  tenantId: string | undefined | null,
  model: { id: string; enabled: boolean } | null | undefined
): Promise<boolean> {
  if (!model) return false;
  if (!model.enabled) return false;
  if (!tenantId) return true;
  try {
    const override = await prisma.aITenantModel.findUnique({
      where: { tenantId_modelId: { tenantId, modelId: model.id } },
      select: { enabled: true },
    });
    if (override) return override.enabled;
    return true;
  } catch {
    return true;
  }
}

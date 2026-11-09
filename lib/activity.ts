import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ActorType = "user" | "ai" | "system";

export type AuditCategory =
  | "auth"
  | "lead"
  | "ai"
  | "email"
  | "research"
  | "config"
  | "security"
  | "workflow"
  | "general";

export interface AuditInput {
  tenantId?: string | null;
  actorId?: string | null;
  actorType?: ActorType;
  action: string;
  category?: AuditCategory;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Record a tenant-visible audit/activity event.
 * This powers BOTH the live activity dashboard (req 7) and the security
 * audit log (req 11). Never throws — auditing must not break the main flow.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? "user",
        action: input.action,
        category: input.category ?? "general",
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[activity] recordAudit failed:", (err as Error).message);
  }
}

export interface LeadActivityInput {
  tenantId: string;
  leadId: string;
  actorId?: string | null;
  activityType: string;
  payload?: Record<string, unknown>;
}

/** Record a per-lead timeline activity. Never throws. */
export async function recordLeadActivity(params: LeadActivityInput): Promise<void> {
  try {
    await prisma.leadActivity.create({
      data: {
        tenantId: params.tenantId,
        leadId: params.leadId,
        actorId: params.actorId ?? null,
        activityType: params.activityType,
        payload: (params.payload ?? undefined) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[activity] recordLeadActivity failed:", (err as Error).message);
  }
}

/** Convenience: derive an actor label for audit metadata. */
export function actorLabel(actorType: ActorType = "user", name?: string | null): string {
  if (actorType === "ai") return "AI agent";
  if (actorType === "system") return "System";
  return name || "User";
}

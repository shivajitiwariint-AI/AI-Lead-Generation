export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "TRIAL"]).optional(),
  operatingMode: z.enum(["FULLY_AI_AUTOMATED", "AI_WITH_APPROVAL", "FULLY_MANUAL"]).optional(),
  automationPaused: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  enabledModules: z.array(z.string()).optional().nullable(),
});

async function requireSuperAdmin(ctx: any) {
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Super admin only" } },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Company not found" } },
      { status: 404 }
    );
  }

  const profile = await prisma.companyProfile.findUnique({ where: { tenantId: tenant.id } });

  const [users, leads, qualified, won, emails, meetings, conversations, aiCost, aiTokens, recentAudit] =
    await Promise.all([
      prisma.tenantUser.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } }),
      prisma.lead.count({ where: { tenantId: tenant.id } }),
      prisma.lead.count({ where: { tenantId: tenant.id, status: "qualified" } }),
      prisma.lead.count({ where: { tenantId: tenant.id, status: "won" } }),
      prisma.message.count({ where: { tenantId: tenant.id, channel: "email", status: "sent" } }),
      prisma.meeting.count({ where: { tenantId: tenant.id } }),
      prisma.conversation.count({ where: { tenantId: tenant.id } }),
      prisma.aICostLog.aggregate({ where: { tenantId: tenant.id }, _sum: { estimatedCost: true } }),
      prisma.aIUsageLog.aggregate({ where: { tenantId: tenant.id }, _sum: { inputTokens: true, outputTokens: true } }),
      prisma.auditLog.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

  const userIds = users.map((u) => u.userId);
  const userRows = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } } }) : [];
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const roles = users.length ? await prisma.role.findMany({ where: { id: { in: users.map((u) => u.roleId) } } }) : [];
  const roleMap = new Map(roles.map((r) => [r.id, r]));

  const members = users.map((u) => {
    const usr = userMap.get(u.userId);
    const role = roleMap.get(u.roleId);
    return {
      id: u.id,
      userId: u.userId,
      name: usr?.name ?? usr?.email ?? "Unknown",
      email: usr?.email ?? "—",
      status: u.status,
      role: role?.name ?? "—",
      roleType: role?.type ?? "—",
      joined: u.createdAt,
    };
  });

  return NextResponse.json({
    company: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      timezone: tenant.timezone,
      operatingMode: tenant.operatingMode,
      automationPaused: tenant.automationPaused,
      aiEnabled: (tenant as any).aiEnabled ?? true,
      enabledModules: tenant.enabledModules,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    },
    profile,
    members,
    progress: {
      leads,
      qualified,
      won,
      emailsSent: emails,
      meetings,
      conversations,
      aiCost: Number(aiCost._sum.estimatedCost ?? 0),
      aiTokens: (aiTokens._sum.inputTokens ?? 0) + (aiTokens._sum.outputTokens ?? 0),
    },
    recentActivity: recentAudit,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const tenant = await prisma.tenant.update({
      where: { id: params.id },
      data: {
        ...(data.status ? { status: data.status as any } : {}),
        ...(data.operatingMode ? { operatingMode: data.operatingMode as any } : {}),
        ...(data.automationPaused !== undefined ? { automationPaused: data.automationPaused } : {}),
        ...(data.aiEnabled !== undefined ? { aiEnabled: data.aiEnabled } : {}),
        ...(data.enabledModules !== undefined ? { enabledModules: data.enabledModules ?? undefined } : {}),
      },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.company_updated",
      category: "config",
      targetType: "tenant",
      targetId: params.id,
      metadata: { ...data },
    });

    return NextResponse.json(tenant);
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id } });
  if (!tenant) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Company not found" } },
      { status: 404 }
    );
  }
  if (tenant.slug === "platform") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Cannot delete the platform tenant" } },
      { status: 403 }
    );
  }

  const name = tenant.name;

  await prisma.leadActivity.deleteMany({ where: { tenantId: params.id } });
  await prisma.leadRequirementValue.deleteMany({ where: { tenantId: params.id } });
  await prisma.leadQualificationResult.deleteMany({ where: { tenantId: params.id } });
  await prisma.leadSource.deleteMany({ where: { tenantId: params.id } });
  await prisma.lead.deleteMany({ where: { tenantId: params.id } });

  await prisma.campaignLead.deleteMany({ where: { tenantId: params.id } });
  await prisma.campaign.deleteMany({ where: { tenantId: params.id } });
  await prisma.campaignFieldDefinition.deleteMany({ where: { tenantId: params.id } });

  await prisma.followupTask.deleteMany({ where: { tenantId: params.id } });

  await prisma.chatMessage.deleteMany({ where: { tenantId: params.id } });
  await prisma.conversation.deleteMany({ where: { tenantId: params.id } });
  await prisma.chatbot.deleteMany({ where: { tenantId: params.id } });
  await prisma.knowledgeChunk.deleteMany({ where: { tenantId: params.id } });
  await prisma.knowledgeDocument.deleteMany({ where: { tenantId: params.id } });

  await prisma.message.deleteMany({ where: { tenantId: params.id } });
  await prisma.messageTemplate.deleteMany({ where: { tenantId: params.id } });

  await prisma.consentRecord.deleteMany({ where: { tenantId: params.id } });
  await prisma.suppressionEntry.deleteMany({ where: { tenantId: params.id } });

  await prisma.integration.deleteMany({ where: { tenantId: params.id } });

  await prisma.subscription.deleteMany({ where: { tenantId: params.id } });

  await prisma.automationJob.deleteMany({ where: { tenantId: params.id } });
  await prisma.outboxEvent.deleteMany({ where: { tenantId: params.id } });
  await prisma.webhookEvent.deleteMany({ where: { tenantId: params.id } });

  await prisma.auditLog.deleteMany({ where: { tenantId: params.id } });

  await prisma.aIUsageLog.deleteMany({ where: { tenantId: params.id } });
  await prisma.aICostLog.deleteMany({ where: { tenantId: params.id } });

  await prisma.aIModuleAssignment.deleteMany({ where: { tenantId: params.id } });
  await prisma.aICredential.deleteMany({ where: { tenantId: params.id } });
  await prisma.aIBudget.deleteMany({ where: { tenantId: params.id } });

  await prisma.researchRun.deleteMany({ where: { tenantId: params.id } });
  await prisma.researchSource.deleteMany({ where: { tenantId: params.id } });

  await prisma.approvalItem.deleteMany({ where: { tenantId: params.id } });
  await prisma.agentRun.deleteMany({ where: { tenantId: params.id } });
  await prisma.meeting.deleteMany({ where: { tenantId: params.id } });

  await prisma.scoringProfile.deleteMany({ where: { tenantId: params.id } });

  await prisma.fileAsset.deleteMany({ where: { tenantId: params.id } });

  await prisma.companyProfile.deleteMany({ where: { tenantId: params.id } });

  // Remove user accounts that no longer belong to any tenant (including the company's members)
  const memberships = await prisma.tenantUser.findMany({
    where: { tenantId: params.id },
    select: { userId: true },
  });
  const userIds = Array.from(new Set(memberships.map((m) => m.userId)));

  await prisma.tenantUser.deleteMany({ where: { tenantId: params.id } });
  await prisma.role.deleteMany({ where: { tenantId: params.id } });

  if (userIds.length > 0) {
    const superAdminUser = await prisma.user.findFirst({
      where: { email: "shivajitiwari@gmail.com" },
      select: { id: true },
    });
    for (const userId of userIds) {
      if (superAdminUser && userId === superAdminUser.id) continue;
      const remaining = await prisma.tenantUser.count({ where: { userId } });
      if (remaining > 0) continue;
      await prisma.account.deleteMany({ where: { userId } });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  }

  await prisma.tenant.delete({ where: { id: params.id } });

  await recordAudit({
    tenantId: null,
    actorId: ctx.userId,
    actorType: "user",
    action: "admin.company_deleted",
    category: "security",
    targetType: "tenant",
    targetId: params.id,
    metadata: { companyName: name, deletedBy: ctx.userEmail },
  });

  return NextResponse.json({ ok: true, message: `Company "${name}" deleted` });
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { id: true, operatingMode: true, automationPaused: true },
  });
  return NextResponse.json(tenant);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!ctx.permissions.includes("settings:write") && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: settings:write" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data: { operatingMode?: string; automationPaused?: boolean } = {};
    if (body.operatingMode) data.operatingMode = body.operatingMode;
    if (typeof body.automationPaused === "boolean") data.automationPaused = body.automationPaused;

    const tenant = await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        ...(data.operatingMode ? { operatingMode: data.operatingMode as any } : {}),
        ...(data.automationPaused !== undefined ? { automationPaused: data.automationPaused } : {}),
      },
      select: { id: true, operatingMode: true, automationPaused: true },
    });

    const action =
      data.automationPaused === true
        ? "takeover.activated"
        : data.automationPaused === false
          ? "takeover.released"
          : "config.operating_mode_changed";

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action,
      category: "config",
      targetType: "tenant",
      targetId: ctx.tenantId,
      metadata: { ...data },
    });

    return NextResponse.json(tenant);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

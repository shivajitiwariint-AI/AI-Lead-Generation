export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { getSchedules, setSchedules } from "@/lib/ai/search-schedule";
import { recordAudit } from "@/lib/activity";

const scheduleSchema = z.object({
  country: z.string().min(1).max(100),
  enabled: z.boolean(),
  everyHours: z.number().min(1).max(720),
});

const bodySchema = z.object({
  tenantId: z.string().optional(),
  schedules: z.array(scheduleSchema).min(1),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const tenantId = new URL(req.url).searchParams.get("tenantId") ?? ctx.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "tenantId required" } },
      { status: 400 }
    );
  }
  if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Cannot view another company's schedules" } },
      { status: 403 }
    );
  }

  const data = await getSchedules(tenantId);
  return NextResponse.json({ tenantId, ...data });
}

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
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
    const body = bodySchema.parse(await req.json());
    const tenantId = body.tenantId ?? ctx.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "tenantId required" } },
        { status: 400 }
      );
    }
    if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot edit another company's schedules" } },
        { status: 403 }
      );
    }

    await setSchedules(tenantId, body.schedules);

    await recordAudit({
      tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "search_schedule.updated",
      category: "config",
      targetType: "company_profile",
      targetId: tenantId,
      metadata: { schedules: body.schedules },
    });

    const data = await getSchedules(tenantId);
    return NextResponse.json({ tenantId, ...data });
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

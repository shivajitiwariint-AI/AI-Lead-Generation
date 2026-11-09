export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const activitySchema = z.object({
  activityType: z.string(),
  payload: z.record(z.string(), z.any()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const activities = await prisma.leadActivity.findMany({
    where: { leadId: params.id, tenantId: ctx.tenantId! },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(activities);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  if (!ctx.permissions.includes("leads:write") && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: leads:write" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const data = activitySchema.parse(body);

    const activity = await prisma.leadActivity.create({
      data: {
        tenantId: ctx.tenantId!,
        leadId: params.id,
        actorId: ctx.userId,
        activityType: data.activityType,
        payload: data.payload ? (JSON.stringify(data.payload) as any) : null,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Create activity error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to create activity" } },
      { status: 500 }
    );
  }
}

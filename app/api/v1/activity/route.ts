export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Number(searchParams.get("limit") ?? 50));
  const actorType = searchParams.get("actorType") || undefined;
  const category = searchParams.get("category") || undefined;
  const since = searchParams.get("since"); // ISO timestamp for polling

  const rows = await prisma.auditLog.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(actorType ? { actorType } : {}),
      ...(category ? { category } : {}),
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ data: rows, serverTime: new Date().toISOString() });
}

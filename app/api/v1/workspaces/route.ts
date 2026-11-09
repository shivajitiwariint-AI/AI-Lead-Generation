export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const userId = (session.user as any).id;
  const memberships = await prisma.tenantUser.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  const tenantIds = memberships.map((m) => m.tenantId);
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
  });
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const workspaces = memberships.map((m) => {
    const t = tenantMap.get(m.tenantId);
    return {
      tenantId: m.tenantId,
      name: t?.name ?? "Workspace",
      slug: t?.slug ?? "",
      status: t?.status ?? "ACTIVE",
      roleId: m.roleId,
    };
  });
  return NextResponse.json({ data: workspaces, current: (session.user as any).tenantId ?? null });
}

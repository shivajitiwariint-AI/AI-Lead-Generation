export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin(ctx: any) {
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Super admin only" } }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const ctx = await getAuthContext();
  const deny = await requireSuperAdmin(ctx);
  if (deny) return deny;

  const [permissions, roles] = await Promise.all([
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
    prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const rps = await prisma.rolePermission.findMany();
  const byRole = new Map<string, string[]>();
  for (const rp of rps) {
    const list = byRole.get(rp.roleId) ?? [];
    list.push(rp.permissionId);
    byRole.set(rp.roleId, list);
  }

  return NextResponse.json({
    permissions,
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      tenantId: r.tenantId,
      description: r.description,
      permissionIds: byRole.get(r.id) ?? [],
    })),
  });
}

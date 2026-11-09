export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

const schema = z.object({
  permissionIds: z.array(z.string()).max(100),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Super admin only" } }, { status: 403 });
  }
  try {
    const role = await prisma.role.findUnique({ where: { id: params.id } });
    if (!role) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Role not found" } }, { status: 404 });
    if (role.type === "SUPER_ADMIN" || role.type === "COMPANY_OWNER") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super Admin and Company Owner always have full access and cannot be edited" } },
        { status: 403 }
      );
    }
    const { permissionIds } = schema.parse(await req.json());
    const valid = await prisma.permission.findMany({ where: { id: { in: permissionIds } }, select: { id: true } });
    if (valid.length !== permissionIds.length) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "One or more permission IDs are invalid" } }, { status: 400 });
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: params.id } });
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: params.id, permissionId })),
      });
    }
    await recordAudit({
      tenantId: null,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.role_updated",
      category: "config",
      targetType: "role",
      targetId: params.id,
      metadata: { roleName: role.name, permissionIds: permissionIds.length },
    });
    return NextResponse.json({ ok: true, roleId: params.id, permissionIds });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: err.message } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "SERVER_ERROR", message: err.message } }, { status: 500 });
  }
}

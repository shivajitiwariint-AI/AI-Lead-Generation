export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";
import crypto from "crypto";

const inviteSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  role: z.enum(["COMPANY_ADMIN", "SALES_MANAGER", "SALES_REPRESENTATIVE", "READ_ONLY_ANALYST"]),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const memberships = await prisma.tenantUser.findMany({
    where: { tenantId: ctx.tenantId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((m) => m.userId) } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const ordered = new Map(memberships.map((m, i) => [m.userId, i]));
  users.sort((a, b) => (ordered.get(a.id) ?? 0) - (ordered.get(b.id) ?? 0));
  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!ctx.permissions.includes("users:write") && !ctx.permissions.includes("settings:write") && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: users:write" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const data = inviteSchema.parse(body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existingUser) {
      // If the user exists and already belongs to this tenant, reject
      const existingMembership = await prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: ctx.tenantId, userId: existingUser.id } },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: { code: "CONFLICT", message: "This user is already a member of this workspace" } },
          { status: 409 }
        );
      }
      // Add existing user to this tenant with the invited role
      const tenantRoles = await prisma.role.findMany({ where: { tenantId: ctx.tenantId } });
      const role = tenantRoles.find((r) => r.type === (data.role as any)) ?? await prisma.role.create({
        data: { tenantId: ctx.tenantId, name: data.role, type: data.role as any, description: "Invited member" },
      });
      await prisma.tenantUser.create({
        data: { tenantId: ctx.tenantId, userId: existingUser.id, roleId: role.id, status: "ACTIVE" },
      });
      await recordAudit({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: "team.member_invited_existing",
        category: "security",
        targetType: "user",
        targetId: existingUser.id,
        metadata: { email: data.email, role: data.role },
      });
      return NextResponse.json({ ok: true, message: "Existing user added to this workspace" }, { status: 201 });
    }

    // New user: generate a temporary password
    const tempPassword = crypto.randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) + "!";
    const hashed = await bcrypt.hash(tempPassword, 12);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email.toLowerCase(), password: hashed, status: "ACTIVE", emailVerified: new Date() },
    });

    const tenantRoles = await prisma.role.findMany({ where: { tenantId: ctx.tenantId } });
    let role = tenantRoles.find((r) => r.type === (data.role as any));
    if (!role) {
      role = await prisma.role.create({
        data: { tenantId: ctx.tenantId, name: data.role, type: data.role as any, description: "Invited member" },
      });
    }

    if (role.type !== "SUPER_ADMIN") {
      const allPerms = await prisma.permission.findMany({ select: { id: true } });
      if (allPerms.length) {
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
        await prisma.rolePermission.createMany({ data: allPerms.map((p) => ({ roleId: role!.id, permissionId: p.id })) });
      }
    }

    await prisma.tenantUser.create({
      data: { tenantId: ctx.tenantId, userId: user.id, roleId: role.id, status: "ACTIVE" },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "team.member_invited",
      category: "security",
      targetType: "user",
      targetId: user.id,
      metadata: { email: data.email, role: data.role },
    });

    return NextResponse.json({ ok: true, email: user.email, tempPassword }, { status: 201 });
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

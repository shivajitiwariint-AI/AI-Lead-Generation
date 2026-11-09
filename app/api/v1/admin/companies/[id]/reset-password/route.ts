export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { recordAudit } from "@/lib/activity";

const resetSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  userId: z.string().optional(), // optional: reset a specific user; default = company owner
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Super admin only" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = resetSchema.parse(body);

    // Find the company owner (or the specified user)
    let targetUserId = data.userId;
    if (!targetUserId) {
      const ownerMembership = await prisma.tenantUser.findFirst({
        where: { tenantId: params.id },
        orderBy: { createdAt: "asc" },
      });
      if (!ownerMembership) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "No users in this company" } },
          { status: 404 }
        );
      }
      targetUserId = ownerMembership.userId;
    }

    // Verify the user belongs to this tenant
    const membership = await prisma.tenantUser.findFirst({
      where: { tenantId: params.id, userId: targetUserId },
    });
    if (!membership) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "User does not belong to this company" } },
        { status: 403 }
      );
    }

    const hashed = await bcrypt.hash(data.newPassword, 12);
    await prisma.user.update({
      where: { id: targetUserId },
      data: { password: hashed },
    });

    const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { name: true } });

    await recordAudit({
      tenantId: params.id,
      actorId: ctx.userId,
      actorType: "user",
      action: "admin.password_reset",
      category: "security",
      targetType: "user",
      targetId: targetUserId,
      metadata: { companyName: tenant?.name, resetBy: ctx.userEmail },
    });

    return NextResponse.json({ ok: true, message: "Password reset successfully" });
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

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = verifySchema.parse(body);

    const token = await prisma.verificationToken.findFirst({
      where: {
        identifier: data.email,
        token: data.code,
        expires: { gt: new Date() },
      },
    });
    if (!token) {
      return NextResponse.json(
        { error: { code: "INVALID_CODE", message: "Invalid or expired verification code" } },
        { status: 400 }
      );
    }

    // Retrieve stashed registration payload (new flow: no User/Tenant written before verification)
    const regToken = await prisma.verificationToken.findFirst({
      where: { identifier: `reg:${data.email}`, expires: { gt: new Date() } },
    });
    let payload: any = null;
    if (regToken) {
      try {
        payload = JSON.parse(regToken.token);
      } catch {
        payload = null;
      }
    }

    // Legacy fallback: older registrations created a pending User before verification.
    let legacyUser = null as any;
    if (!payload?.password) {
      legacyUser = await prisma.user.findUnique({ where: { email: data.email } });
      if (!legacyUser) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Registration not found or expired. Please sign up again." } },
          { status: 404 }
        );
      }
    } else {
      // Safety: if a user somehow already exists, do not overwrite; treat as conflict.
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        return NextResponse.json(
          { error: { code: "EMAIL_EXISTS", message: "Email already registered. Please sign in." } },
          { status: 409 }
        );
      }
    }

    const companyName = payload?.companyName || "My Company";
    const industry = payload?.industry || null;

    // Slug
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    const finalSlug = existingTenant ? `${slug}-${Date.now().toString(36)}` : slug;

    const plan = await prisma.plan.findFirst({ where: { name: "Starter" } });

    // Create user (new flow) + tenant/company/role/membership in transaction
    await prisma.$transaction(async (tx: any) => {
      let userId: string;
      if (payload?.password) {
        const created = await tx.user.create({
          data: {
            name: payload.name ?? null,
            email: payload.email ?? data.email,
            phone: payload.phone ?? null,
            password: payload.password, // already hashed at registration
            status: "ACTIVE",
            emailVerified: new Date(),
          },
        });
        userId = created.id;
      } else {
        userId = legacyUser.id;
      }

      const tenant = await tx.tenant.create({
        data: {
          name: companyName,
          slug: finalSlug,
          status: "ACTIVE",
          timezone: "UTC",
          planId: plan?.id,
        },
      });

      await tx.companyProfile.create({
        data: {
          tenantId: tenant.id,
          industry,
          onboardingCompleted: false,
        },
      });

      let ownerRole = await tx.role.findFirst({
        where: { tenantId: tenant.id, type: "COMPANY_OWNER" },
      });
      if (!ownerRole) {
        const allPermissions = await tx.permission.findMany();
        ownerRole = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: "Company Owner",
            type: "COMPANY_OWNER",
            description: "Full access within their company",
          },
        });
        if (allPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: allPermissions.map((p: any) => ({
              roleId: ownerRole.id,
              permissionId: p.id,
            })),
          });
        }
      }

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId,
          roleId: ownerRole.id,
          status: "ACTIVE",
        },
      });

      if (!payload?.password) {
        // legacy: mark the pre-existing pending user verified/active
        await tx.user.update({
          where: { id: userId },
          data: { emailVerified: new Date(), status: "ACTIVE" },
        });
      }
    });

    // Clean up tokens
    await prisma.verificationToken.deleteMany({
      where: { identifier: data.email },
    });
    await prisma.verificationToken.deleteMany({
      where: { identifier: `reg:${data.email}` },
    });

    return NextResponse.json({ ok: true, message: "Email verified. You can now sign in." });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Verification failed" } },
      { status: 500 }
    );
  }
}

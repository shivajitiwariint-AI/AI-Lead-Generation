export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
  industry: z.string().optional(),
  phone: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      // Allow re-registration if the account was never verified (legacy/stale unverified user).
      // Verified/active accounts must not be overwritten.
      if (existingUser.status === "PENDING_VERIFICATION" && !existingUser.emailVerified) {
        await prisma.verificationToken.deleteMany({ where: { identifier: data.email } });
        await prisma.verificationToken.deleteMany({ where: { identifier: `reg:${data.email}` } });
        await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => {});
      } else {
        return NextResponse.json(
          { error: { code: "EMAIL_EXISTS", message: "Email already registered" } },
          { status: 409 }
        );
      }
    }

    // Check if tenant slug already exists
    const slug = data.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      return NextResponse.json(
        { error: { code: "SLUG_EXISTS", message: "Company name already in use" } },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Clean up any stale tokens for this email (also supports re-registration before verification)
    await prisma.verificationToken.deleteMany({ where: { identifier: data.email } });
    await prisma.verificationToken.deleteMany({ where: { identifier: `reg:${data.email}` } });

    // Generate a unique verification code
    const crypto = await import("crypto");
    const code = crypto.randomBytes(4).toString("hex"); // 8 hex chars
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.verificationToken.create({
      data: {
        identifier: data.email,
        token: code,
        expires,
      },
    });

    // Stash full registration payload so NO User/Tenant data is written until after email verification.
    // (Password is stored hashed.)
    await prisma.verificationToken.create({
      data: {
        identifier: `reg:${data.email}`,
        token: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          companyName: data.companyName,
          industry: data.industry ?? null,
          password: hashedPassword,
        }),
        expires,
      },
    });

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      email: data.email,
      // Demo-only: surface the code on screen since no email provider is configured.
      devCode: code,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Registration failed" } },
      { status: 500 }
    );
  }
}

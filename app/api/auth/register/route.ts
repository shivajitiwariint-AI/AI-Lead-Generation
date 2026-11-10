export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSystemSmtpConfigured, sendSystemEmail } from "@/lib/smtp";
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

    // Deliver the verification code by email. In production a delivery failure aborts
    // registration instead of leaking the code in the API response.
    const baseUrl =
      process.env.NEXTAUTH_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      process.env.BASE_URL?.trim() ||
      req.nextUrl.origin;

    const verifyUrl = `${baseUrl.replace(/\/$/, "")}/auth/verify-email?email=${encodeURIComponent(
      data.email
    )}&code=${encodeURIComponent(code)}`;

    let emailSent = false;
    if (isSystemSmtpConfigured()) {
      try {
        await sendSystemEmail({
          to: data.email,
          subject: "Verify your email — AI Lead Gen",
          text: [
            `Hi ${data.name},`,
            "",
            "Thanks for signing up for AI Lead Gen.",
            "",
            `Your verification code is: ${code}`,
            "",
            `Verify your email: ${verifyUrl}`,
            "",
            "This code expires in 24 hours. If you did not create this account, you can ignore this email.",
          ].join("\n"),
          html: `
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0f172a">
              <h2 style="margin:0 0 16px;font-size:22px">Verify your email</h2>
              <p style="margin:0 0 12px">Hi ${data.name},</p>
              <p style="margin:0 0 20px">Thanks for signing up for AI Lead Gen. Enter this code to activate your account:</p>
              <p style="margin:0 0 24px;font-size:30px;font-weight:700;letter-spacing:6px;color:#4f46e5">${code}</p>
              <p style="margin:0 0 24px">
                <a href="${verifyUrl}" style="background:#4f46e5;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#475569">Or open this link: <a href="${verifyUrl}">${verifyUrl}</a></p>
              <p style="margin:16px 0 0;font-size:13px;color:#64748b">This code expires in 24 hours. If you did not create this account, you can ignore this email.</p>
            </div>
          `,
        });
        emailSent = true;
      } catch (err) {
        console.error("[register] verification email failed:", (err as Error).message);
        await prisma.verificationToken.deleteMany({ where: { identifier: data.email } });
        await prisma.verificationToken.deleteMany({ where: { identifier: `reg:${data.email}` } });
        return NextResponse.json(
          {
            error: {
              code: "EMAIL_SEND_FAILED",
              message: "We couldn't send the verification email. Please try again in a moment.",
            },
          },
          { status: 503 }
        );
      }
    }

    if (!emailSent && process.env.NODE_ENV === "production") {
      await prisma.verificationToken.deleteMany({ where: { identifier: data.email } });
      await prisma.verificationToken.deleteMany({ where: { identifier: `reg:${data.email}` } });
      return NextResponse.json(
        {
          error: {
            code: "EMAIL_NOT_CONFIGURED",
            message: "Email delivery is not configured. Please contact support.",
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      needsVerification: true,
      email: data.email,
      emailSent,
      // Local development only: surface the code on screen when no mail transport exists.
      ...(emailSent ? {} : { devCode: code }),
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

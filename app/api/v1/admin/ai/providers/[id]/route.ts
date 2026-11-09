export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";

const updateProviderSchema = z.object({
  displayName: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const credentialSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const data = updateProviderSchema.parse(body);

    const provider = await prisma.aIProvider.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(provider);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const data = credentialSchema.parse(body);

    const provider = await prisma.aIProvider.findUnique({
      where: { id: params.id },
    });
    if (!provider) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Provider not found" } },
        { status: 404 }
      );
    }

    const existing = await prisma.aICredential.findFirst({
      where: { providerId: params.id, tenantId: null },
    });

    if (existing) {
      await prisma.aICredential.update({
        where: { id: existing.id },
        data: {
          encryptedSecret: encryptSecret(data.apiKey),
          keyVersion: existing.keyVersion + 1,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.aICredential.create({
        data: {
          tenantId: null,
          providerId: params.id,
          encryptedSecret: encryptSecret(data.apiKey),
          keyVersion: 1,
        },
      });
    }

    return NextResponse.json({ ok: true, masked: `****${data.apiKey.slice(-4)}` });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();

    await prisma.aIProvider.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === "Forbidden: insufficient role") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Super admin access required" } },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

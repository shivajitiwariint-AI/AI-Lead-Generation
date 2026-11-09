export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const jobSchema = z.object({
  jobType: z.string(),
  status: z.string().optional(),
  tenantId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") || ctx.tenantId!;
  const jobType = searchParams.get("jobType") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: any = { tenantId };
  if (jobType) where.jobType = jobType;
  if (status) where.status = status;

  const jobs = await prisma.automationJob.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const data = jobSchema.parse(body);

    const job = await prisma.automationJob.create({
      data: {
        tenantId: ctx.tenantId!,
        jobType: data.jobType,
        status: "pending",
        runAt: new Date(),
        payload: "{}",
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { qualifyAndMatchLead } from "@/lib/ai/qualification";
import { recordAudit } from "@/lib/activity";

const qualificationSchema = z.object({
  campaignId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  if (!ctx.permissions.includes("leads:write") && !ctx.isSuperAdmin) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Missing permission: leads:write" } },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const data = qualificationSchema.parse(body);

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId") || (await extractLeadIdFromPath(req));
    if (!leadId) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "leadId is required" } },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId: ctx.tenantId! },
    });
    if (!lead) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found" } },
        { status: 404 }
      );
    }

    const outcome = await qualifyAndMatchLead({
      tenantId: ctx.tenantId!,
      leadId,
      actorId: ctx.userId,
      actorType: "user",
      campaignId: data.campaignId,
    });

    return NextResponse.json({
      qualificationId: outcome.qualificationId,
      fitScore: outcome.fitScore,
      intentScore: outcome.intentScore,
      urgencyScore: outcome.urgencyScore,
      completenessScore: outcome.completenessScore,
      totalScore: outcome.totalScore,
      band: outcome.band,
      summary: outcome.summary,
      nextAction: outcome.nextAction,
      confidence: outcome.confidence,
      matchScore: outcome.matchScore,
      matchedOffers: outcome.matchedOffers,
      mock: outcome.mock,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Qualification error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

// The route is /api/v1/leads/[id]/qualify but is invoked as POST with ?leadId=.
// Also accept the lead id embedded in the URL path for callers that use it.
async function extractLeadIdFromPath(req: NextRequest): Promise<string | null> {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("leads");
    if (idx >= 0 && parts[idx + 1] && parts[idx + 1] !== "qualify") return parts[idx + 1];
  } catch {
    /* noop */
  }
  return null;
}

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "leadId is required" } },
      { status: 400 }
    );
  }

  const qualification = await prisma.leadQualificationResult.findFirst({
    where: { leadId, tenantId: ctx.tenantId! },
    orderBy: { createdAt: "desc" },
  });

  if (!qualification) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No qualification found" } },
      { status: 404 }
    );
  }

  return NextResponse.json(qualification);
}

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { checkSharedRateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/activity";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  requirement: z.string().optional().nullable(),
  status: z.string().optional(),
  sourceId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const rl = await checkSharedRateLimit(
    [`leads-list:tenant:${ctx.tenantId ?? ctx.userId}`, `leads-list:user:${ctx.userId}`],
    120,
    60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many requests — slow down." } },
      { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const source = searchParams.get("source") || "";
  const minRelevance = parseInt(searchParams.get("minRelevance") || "0", 10);
  const minQuality = parseInt(searchParams.get("minQuality") || "0", 10);
  const emailVerified = searchParams.get("emailVerified") === "true";
  const phoneVerified = searchParams.get("phoneVerified") === "true";
  const sort = searchParams.get("sort") || "recent"; // recent | relevance | quality | score

  const where: any = {
    tenantId: ctx.tenantId!,
  };
  if (minRelevance > 0) where.relevanceScore = { gte: minRelevance };
  if (minQuality > 0) where.dataQualityScore = { gte: minQuality };
  if (emailVerified) where.emailVerified = true;
  if (phoneVerified) where.phoneVerified = true;

  if (search) {
    // MySQL/TiDB string comparisons are case-insensitive with the default
    // collation, and Prisma's `mode` option is not supported by this connector.
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { company: { contains: search } },
    ];
  }
  if (status) where.status = status;
  if (source) {
    const srcLeads = await prisma.leadSource.findMany({
      where: { tenantId: ctx.tenantId!, sourceType: source },
      select: { leadId: true },
      distinct: ["leadId"],
    });
    where.id = { in: srcLeads.map((s) => s.leadId) };
  }

  const orderBy: any =
    sort === "relevance" ? { relevanceScore: "desc" } :
    sort === "quality" ? { dataQualityScore: "desc" } :
    sort === "score" ? { score: "desc" } :
    { createdAt: "desc" };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  const leadSourceRows = leads.length
    ? await prisma.leadSource.findMany({
        where: { tenantId: ctx.tenantId!, leadId: { in: leads.map((l) => l.id) } },
      })
    : [];
  const sourceByLead = new Map(leadSourceRows.map((s) => [s.leadId, s.sourceType]));

  // Resolve owner display names (ownerId is a User id) — was showing bare "Assigned"
  const ownerIds = Array.from(new Set(leads.map((l) => l.ownerId).filter(Boolean) as string[]));
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, email: true } })
    : [];
  const ownerById = new Map(owners.map((u) => [u.id, u]));
  const data = leads.map((l) => {
    const owner = l.ownerId ? ownerById.get(l.ownerId) : null;
    return {
      ...l,
      sourceType: sourceByLead.get(l.id) ?? "manual",
      ownerName: owner?.name ?? owner?.email ?? null,
      ownerEmail: owner?.email ?? null,
    };
  });

  return NextResponse.json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

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
    const body = await req.json();
    const data = leadSchema.parse(body);

    const lead = await prisma.lead.create({
      data: {
        tenantId: ctx.tenantId!,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        website: data.website ?? null,
        industry: data.industry ?? null,
        location: data.location ?? null,
        requirement: data.requirement ?? null,
        status: data.status ?? "new",
        sourceId: data.sourceId ?? null,
        ownerId: data.ownerId ?? ctx.userId,
      },
    });

    await prisma.leadActivity.create({
      data: {
        tenantId: ctx.tenantId!,
        leadId: lead.id,
        actorId: ctx.userId,
        activityType: "lead_created",
        payload: JSON.stringify({ source: "manual" }),
      },
    });

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "lead.created",
      category: "lead",
      targetType: "lead",
      targetId: lead.id,
      metadata: { leadName: lead.name, email: lead.email, source: "manual" },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Create lead error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to create lead" } },
      { status: 500 }
    );
  }
}

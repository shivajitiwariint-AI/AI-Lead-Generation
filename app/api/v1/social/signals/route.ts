export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  saveSocialSignal,
  type SignalPlatform,
} from "@/lib/social/signals";
import { recordAudit } from "@/lib/activity";

const createSchema = z.object({
  platform: z.enum([
    "youtube",
    "x",
    "reddit",
    "instagram",
    "tiktok",
    "linkedin",
    "manual",
  ]),
  kind: z.enum(["video", "short", "reel", "post"]),
  title: z.string().min(1).max(300),
  url: z.string().url().max(500),
  author: z.string().max(200).optional().nullable(),
  authorHandle: z.string().max(200).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  views: z.number().int().min(0).optional().nullable(),
  likes: z.number().int().min(0).optional().nullable(),
  comments: z.number().int().min(0).optional().nullable(),
  shares: z.number().int().min(0).optional().nullable(),
  durationSec: z.number().int().min(0).optional().nullable(),
  snippet: z.string().max(4000).optional().nullable(),
  relevanceScore: z.number().int().min(0).max(100).optional(),
});

const SORT_FIELDS = new Set([
  "publishedAt",
  "relevanceScore",
  "views",
  "likes",
  "comments",
  "createdAt",
]);

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const requestedTenant = searchParams.get("tenantId");
  const tenantId =
    ctx.isSuperAdmin && requestedTenant
      ? requestedTenant
      : ctx.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: { code: "NO_TENANT", message: "No active company selected" } },
      { status: 400 }
    );
  }

  const search = (searchParams.get("search") ?? "").trim().slice(0, 200);
  const platform = (searchParams.get("platform") ?? "").trim();
  const kind = (searchParams.get("kind") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();
  const sort = searchParams.get("sort") ?? "publishedAt";
  const sortField = SORT_FIELDS.has(sort) ? sort : "publishedAt";
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(Number(searchParams.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 25, 1), 100);

  const where: any = { tenantId };
  if (platform && platform !== "all") where.platform = platform;
  if (kind && kind !== "all") where.kind = kind;
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { author: { contains: search } },
      { snippet: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.socialSignal.count({ where }),
    prisma.socialSignal.findMany({
      where,
      orderBy: { [sortField]: dir } as any,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    data: rows,
    meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  try {
    const data = createSchema.parse(await req.json());
    const id = await saveSocialSignal(ctx.tenantId, {
      platform: data.platform as SignalPlatform,
      kind: data.kind,
      title: data.title,
      url: data.url,
      author: data.author,
      authorHandle: data.authorHandle,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      views: data.views,
      likes: data.likes,
      comments: data.comments,
      shares: data.shares,
      durationSec: data.durationSec,
      snippet: data.snippet,
      relevanceScore: data.relevanceScore ?? 0,
      sourceQuery: "manual",
      metadata: { source: "manual_entry" },
    });
    if (!id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "A title and a valid URL are required" } },
        { status: 400 }
      );
    }

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "social.signal_added",
      category: "research",
      targetType: "social_signal",
      targetId: id,
      metadata: { platform: data.platform, kind: data.kind },
    });

    return NextResponse.json({ ok: true, id });
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

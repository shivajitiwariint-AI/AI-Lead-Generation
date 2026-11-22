export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { discoverSocialSignals } from "@/lib/social/signals";
import { checkSharedRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  query: z.string().min(1).max(300),
  maxResults: z.number().int().min(1).max(25).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated || !ctx.tenantId) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const limit = await checkSharedRateLimit(
    [`social:discover:${ctx.tenantId}`, `social:discover:user:${ctx.userId}`],
    10,
    60_000
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many discovery requests" } },
      { status: 429 }
    );
  }

  try {
    const data = schema.parse(await req.json());
    const result = await discoverSocialSignals(
      ctx.tenantId,
      data.query,
      data.maxResults ?? 10,
      ctx.userId
    );
    return NextResponse.json({ ok: true, ...result });
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

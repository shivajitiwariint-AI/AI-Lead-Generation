export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { listDataSourceStatus } from "@/lib/data-sources";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const all = await listDataSourceStatus(ctx.tenantId);
  return NextResponse.json(
    all.map((s) => ({
      key: s.key,
      label: s.label,
      category: s.category,
      configured: s.configured,
      enabled: s.enabled,
      source: s.source,
    }))
  );
}

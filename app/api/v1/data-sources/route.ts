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
  // Return the full status (including masked keys) so company-facing cards can
  // render the same detail as the admin matrix, scoped to this workspace.
  return NextResponse.json(all);
}

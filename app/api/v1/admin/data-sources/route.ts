export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { listDataSourceMatrix } from "@/lib/data-sources";

/**
 * Global + per-company data source key matrix. Super-admin only; secrets are
 * never returned, only masked last-four digits.
 */
export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json(await listDataSourceMatrix());
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

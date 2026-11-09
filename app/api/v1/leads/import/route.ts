export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";

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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No file provided" } },
        { status: 400 }
      );
    }

    if (
      !file.name.endsWith(".csv") &&
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Only CSV/Excel files are allowed" } },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const text = Buffer.from(bytes).toString("utf-8");

    // Simple CSV parser
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "File must have header and at least one row" } },
        { status: 400 }
      );
    }

    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/"/g, ""));

    const requiredHeaders = ["name"];
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Missing required columns: ${missing.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || null;
      });

      try {
        if (!row.name) {
          errors.push({ row: i + 1, error: "Name is required" });
          continue;
        }

        const lead = await prisma.lead.create({
          data: {
            tenantId: ctx.tenantId!,
            name: row.name,
            email: row.email || null,
            phone: row.phone || null,
            company: row.company || null,
            status: "new",
            sourceId: null,
            ownerId: ctx.userId,
          },
        });

        results.push(lead);
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    await recordAudit({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      actorType: "user",
      action: "lead.imported",
      category: "lead",
      targetType: "lead",
      targetId: null,
      metadata: { imported: results.length, failed: errors.length, file: file.name },
    });

    return NextResponse.json({
      imported: results.length,
      errors: errors.length,
      details: errors,
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Import failed" } },
      { status: 500 }
    );
  }
}

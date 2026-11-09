export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";
import { getAuthContext } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

const ingestSchema = z.object({
  source: z.string(),
  externalId: z.string().optional(),
  contact: z.object({
    name: z.string(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
  }),
  company: z.object({
    name: z.string().optional().nullable(),
    website: z.string().url().optional().nullable(),
  }).optional(),
  requirement: z.string().optional().nullable(),
  consent: z.object({
    marketing: z.boolean().optional().default(false),
    capturedAt: z.string().datetime().optional(),
    method: z.string().optional(),
    policyVersion: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Token-based access: session (cookie) OR X-API-TOKEN matching INGEST_API_KEY
    const ctx = await getAuthContext();
    const apiToken = req.headers.get("x-api-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const expected = (process.env.INGEST_API_KEY ?? "").trim();
    const tokenOk = expected.length >= 16 && apiToken === expected;
    if (!ctx.isAuthenticated && !tokenOk) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Session or X-API-TOKEN required" } },
        { status: 401 }
      );
    }
    if (ctx.isAuthenticated && ctx.tenantId && ctx.tenantId !== "demo-tenant-id" && !tokenOk) {
      // Session users must ingest into their own tenant (header tenantId ignored for security)
    }

    const rl = checkRateLimit(`ingest:${ctx.tenantId ?? "anon"}`, 60, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMIT", message: "Too many ingest requests — wait a minute and try again." } },
        { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
      );
    }

    const body = await req.json();
    const data = ingestSchema.parse(body);

    // Session users are pinned to their own tenant; API-token callers may target any tenant via header
    const tenantId = ctx.isAuthenticated && ctx.tenantId ? ctx.tenantId : req.headers.get("x-tenant-id") || "demo-tenant-id";

    let existingLead = null;
    if (data.contact.email) {
      existingLead = await prisma.lead.findFirst({
        where: {
          tenantId,
          email: data.contact.email,
        },
      });
    }
    if (!existingLead && data.contact.phone) {
      existingLead = await prisma.lead.findFirst({
        where: {
          tenantId,
          phone: data.contact.phone,
        },
      });
    }

    let lead;
    if (existingLead) {
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          name: data.contact.name || existingLead.name,
          phone: data.contact.phone || existingLead.phone,
          company: data.company?.name || existingLead.company,
          website: data.company?.website || existingLead.website,
          requirement: data.requirement || existingLead.requirement,
          updatedAt: new Date(),
        },
      });
    } else {
      lead = await prisma.lead.create({
        data: {
          tenantId,
          name: data.contact.name,
          email: data.contact.email ?? null,
          phone: data.contact.phone ?? null,
          company: data.company?.name ?? null,
          website: data.company?.website ?? null,
          requirement: data.requirement ?? null,
          status: "new",
          sourceId: null,
          ownerId: null,
        },
      });
    }

    await prisma.leadSource.create({
      data: {
        tenantId,
        leadId: lead.id,
        sourceType: data.source,
        externalId: data.externalId ?? null,
        attribution: JSON.stringify({ source: data.source }),
      },
    });

    if (data.consent) {
      await prisma.consentRecord.create({
        data: {
          tenantId,
          leadId: lead.id,
          purpose: "marketing",
          status: data.consent.marketing ? "granted" : "denied",
          capturedAt: data.consent.capturedAt
            ? new Date(data.consent.capturedAt)
            : new Date(),
          source: data.consent.method ?? "unknown",
          policyVersion: data.consent.policyVersion ?? null,
        },
      });
    }

    await prisma.outboxEvent.create({
      data: {
        tenantId,
        eventType: "lead.ingest",
        payload: JSON.stringify({ leadId: lead.id, source: data.source, isDuplicate: !!existingLead }),
      },
    });

    await recordAudit({
      tenantId,
      actorId: null,
      actorType: "system",
      action: "lead.ingested",
      category: "lead",
      targetType: "lead",
      targetId: lead.id,
      metadata: { source: data.source, isDuplicate: !!existingLead },
    });

    return NextResponse.json({
      leadId: lead.id,
      status: existingLead ? "updated" : "accepted",
      isDuplicate: !!existingLead,
    }, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: error.message } },
        { status: 400 }
      );
    }
    console.error("Ingest lead error:", error);
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: "Failed to ingest lead" } },
      { status: 500 }
    );
  }
}

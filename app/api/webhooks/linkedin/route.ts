export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { recordAudit } from "@/lib/activity";
import { checkSharedRateLimit } from "@/lib/rate-limit";
import {
  candidateConfigs,
  claimWebhookEvent,
  createLeadFromFormSubmission,
  explicitTenantFrom,
  findSignedConfig,
  findVerifyConfig,
  mapFormFields,
  tenantExists,
} from "@/lib/social/lead-forms";

const PLATFORM = "linkedin" as const;

/** LinkedIn Lead Gen Forms webhook verification (GET) and delivery (POST). */
export async function GET(req: NextRequest) {
  const challenge =
    req.nextUrl.searchParams.get("hub.challenge") ??
    req.nextUrl.searchParams.get("challenge");
  const token =
    req.nextUrl.searchParams.get("hub.verify_token") ??
    req.nextUrl.searchParams.get("verify_token") ??
    req.headers.get("x-li-verification-token") ??
    "";
  if (!challenge) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Missing challenge" } },
      { status: 400 }
    );
  }

  const explicit = explicitTenantFrom(req);
  const configs = await candidateConfigs(
    PLATFORM,
    { accountIds: [], formIds: [] },
    explicit
  );
  const matched = findVerifyConfig(token, configs);
  if (!matched || !(await tenantExists(matched.tenantId))) {
    await recordAudit({
      tenantId: null,
      actorType: "system",
      action: "webhook.rejected",
      category: "security",
      targetType: "webhook_event",
      targetId: null,
      metadata: { provider: PLATFORM, reason: "invalid verify token" },
    });
    return NextResponse.json(
      { error: { code: "INVALID_TOKEN", message: "Verification token mismatch" } },
      { status: 403 }
    );
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkSharedRateLimit([`webhook:linkedin:${ip}`], 120, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many webhook requests" } },
      { status: 429 }
    );
  }

  const raw = await req.text();
  let body: any = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } },
      { status: 400 }
    );
  }

  const eventBody = body?.eventBody ?? body;
  const leadEvent =
    eventBody?.leadGenerated ??
    eventBody?.leadGenFormResponse ??
    (eventBody?.leadId ? eventBody : null) ??
    {};
  const leadId = String(leadEvent.leadId ?? "");
  const formId = String(leadEvent.formId ?? "");
  const ownerId = String(leadEvent.ownerId ?? "");

  const configs = await candidateConfigs(
    PLATFORM,
    { accountIds: ownerId ? [ownerId] : [], formIds: formId ? [formId] : [] },
    explicitTenantFrom(req)
  );
  const signature =
    req.headers.get("linkedin-signature") ??
    req.headers.get("x-li-signature") ??
    req.headers.get("x-linkedin-signature") ??
    req.headers.get("x-hub-signature-256") ??
    req.headers.get("x-webhook-signature") ??
    "";
  const config = findSignedConfig(raw, signature, configs);

  if (!config || !(await tenantExists(config.tenantId))) {
    await recordAudit({
      tenantId: null,
      actorType: "system",
      action: "webhook.rejected",
      category: "security",
      targetType: "webhook_event",
      targetId: null,
      metadata: { provider: PLATFORM, reason: "invalid signature", ip },
    });
    return NextResponse.json(
      { error: { code: "INVALID_SIGNATURE", message: "Invalid signature" } },
      { status: 401 }
    );
  }

  const dedupeKey = leadId || String(body?.eventId ?? "");
  if (!dedupeKey) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "No lead id in webhook" } },
      { status: 400 }
    );
  }
  const claimed = await claimWebhookEvent(config.tenantId, PLATFORM, dedupeKey);
  if (!claimed) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const errors: string[] = [];
  try {
    if (!formId) throw new Error("Missing form id — cannot fetch lead details");
    if (!config.accessToken) {
      throw new Error("No LinkedIn access token configured for this company");
    }

    const params = new URLSearchParams({ start: "0", count: "100" });
    const res = await fetch(
      `https://api.linkedin.com/v2/leadForms/${encodeURIComponent(formId)}/leads?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) throw new Error(`Lead Forms API HTTP ${res.status}`);
    const data = await res.json();
    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];
    const element =
      elements.find((item) => String(item?.leadId ?? "") === leadId) ??
      (elements.length === 1 ? elements[0] : null);

    const inlineValues =
      leadEvent?.leadGenFormData?.values ?? leadEvent?.fieldValues ?? null;
    const values = element?.leadGenFormData?.values ?? inlineValues;
    if (!values) {
      throw new Error("Lead details were not present in the API response");
    }

    const result = await createLeadFromFormSubmission({
      tenantId: config.tenantId,
      platform: PLATFORM,
      externalId: leadId,
      fields: mapFormFields(values),
      formId,
      accountId: ownerId || null,
      createdTime: (() => {
        const created = element?.createdTime ?? leadEvent.createdTime;
        if (created == null) return null;
        const numeric = Number(created);
        const date = Number.isFinite(numeric) && numeric > 0 && numeric < 1e12
          ? new Date(numeric * 1000)
          : new Date(created);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      })(),
      rawFieldNames: Array.isArray(values)
        ? values
            .map((value: any) =>
              String(
                value?.fieldName?.localizedName ??
                  value?.fieldName ??
                  value?.name ??
                  ""
              )
            )
            .filter(Boolean)
        : [],
    });

    await recordAudit({
      tenantId: config.tenantId,
      actorType: "system",
      action: "webhook.received",
      category: "security",
      targetType: "webhook_event",
      targetId: null,
      metadata: {
        provider: PLATFORM,
        leadId,
        formId,
        leadCreated: result.created,
        duplicate: result.duplicate,
        errors: result.reason ? [result.reason] : [],
      },
    });

    return NextResponse.json({
      ok: true,
      leadId: result.leadId,
      created: result.created,
      duplicate: result.duplicate,
      errors: result.reason ? [result.reason] : [],
    });
  } catch (error: any) {
    errors.push(error.message);
    await recordAudit({
      tenantId: config.tenantId,
      actorType: "system",
      action: "webhook.failed",
      category: "security",
      targetType: "webhook_event",
      targetId: null,
      metadata: { provider: PLATFORM, leadId, formId, errors },
    });
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }
}

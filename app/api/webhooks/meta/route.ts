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

const PLATFORM = "meta" as const;

/** Meta Lead Ads webhook verification (GET) and lead delivery (POST). */
export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const token =
    req.nextUrl.searchParams.get("hub.verify_token") ??
    req.nextUrl.searchParams.get("verify_token") ??
    "";
  if (!challenge) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Missing hub.challenge" } },
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
  const rate = await checkSharedRateLimit([`webhook:meta:${ip}`], 120, 60_000);
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

  const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
  const hints = {
    accountIds: entries
      .flatMap((entry) => (Array.isArray(entry?.changes) ? entry.changes : []))
      .map((change: any) => String(change?.value?.page_id ?? ""))
      .filter(Boolean),
    formIds: entries
      .flatMap((entry) => (Array.isArray(entry?.changes) ? entry.changes : []))
      .map((change: any) => String(change?.value?.form_id ?? ""))
      .filter(Boolean),
  };

  const explicit = explicitTenantFrom(req);
  const configs = await candidateConfigs(PLATFORM, hints, explicit);
  const signature =
    req.headers.get("x-hub-signature-256") ??
    req.headers.get("x-hub-signature") ??
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

  let processed = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== "leadgen") continue;
      const value = change?.value ?? {};
      const leadgenId = String(value.leadgen_id ?? value.lead_id ?? "");
      if (!leadgenId) continue;

      const claimed = await claimWebhookEvent(config.tenantId, PLATFORM, leadgenId);
      if (!claimed) continue;

      try {
        let detail: any = null;
        let fields = mapFormFields(value?.field_data);
        if (config.accessToken) {
          const params = new URLSearchParams({
            fields: "field_data,form_id,ad_id,campaign_id,page_id,created_time",
            access_token: config.accessToken,
          });
          const res = await fetch(
            `https://graph.facebook.com/v20.0/${encodeURIComponent(leadgenId)}?${params.toString()}`,
            { signal: AbortSignal.timeout(15000) }
          );
          if (res.ok) {
            detail = await res.json();
            fields = mapFormFields(detail?.field_data ?? value?.field_data);
          } else {
            errors.push(`Graph API HTTP ${res.status} for lead ${leadgenId}`);
          }
        }

        const result = await createLeadFromFormSubmission({
          tenantId: config.tenantId,
          platform: PLATFORM,
          externalId: leadgenId,
          fields,
          formId: String(detail?.form_id ?? value.form_id ?? ""),
          accountId: String(detail?.page_id ?? value.page_id ?? ""),
          adId: String(detail?.ad_id ?? value.ad_id ?? ""),
          campaignId: String(detail?.campaign_id ?? value.campaign_id ?? ""),
          createdTime: (() => {
            const created = detail?.created_time ?? value.created_time;
            return created ? String(created) : null;
          })(),
          rawFieldNames: Array.isArray(detail?.field_data)
            ? detail.field_data.map((f: any) => String(f?.name ?? "")).filter(Boolean)
            : [],
        });
        if (result.leadId) processed++;
        if (result.reason) errors.push(result.reason);
      } catch (error: any) {
        errors.push(`Lead ${leadgenId}: ${error.message}`);
      }
    }
  }

  await recordAudit({
    tenantId: config.tenantId,
    actorType: "system",
    action: "webhook.received",
    category: "security",
    targetType: "webhook_event",
    targetId: null,
    metadata: { provider: PLATFORM, processed, errors },
  });

  return NextResponse.json({ ok: true, processed, errors });
}

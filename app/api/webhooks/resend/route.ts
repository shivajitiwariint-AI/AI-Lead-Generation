export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/activity";
import { checkSharedRateLimit } from "@/lib/rate-limit";

/**
 * Secure webhook receiver (Resend delivery events + generic signed webhooks).
 * Signature: HMAC-SHA256(WEBHOOK_SECRET, rawBody) sent as
 *   x-webhook-signature (hex) or x-resend-signature.
 * Idempotent via WebhookEvent.externalId uniqueness.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkSharedRateLimit([`webhook:ip:${ip}`], 200, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: { code: "RATE_LIMIT", message: "Too many webhook requests" } }, { status: 429 });
  }

  const secret = (process.env.WEBHOOK_SECRET ?? process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "Webhook secret not configured" } }, { status: 503 });
  }

  const raw = await req.text();
  const sig = (req.headers.get("x-webhook-signature") ?? req.headers.get("x-resend-signature") ?? "").trim();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  let valid = false;
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    valid = a.length === b.length && createHmac("sha256", secret).update(raw).digest("hex") === sig;
  } catch {}
  if (!valid) {
    await recordAudit({
      tenantId: null,
      actorType: "system",
      action: "webhook.rejected",
      category: "security",
      targetType: "webhook_event",
      targetId: null,
      metadata: { reason: "invalid signature", ip },
    }).catch(() => {});
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Invalid signature" } }, { status: 401 });
  }

  let body: any = {};
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON" } }, { status: 400 });
  }

  const eventId = String(body?.eventId ?? body?.id ?? `wh_${Date.now()}`);
  const type = String(body?.type ?? body?.event ?? "email.event");

  // Resolve tenant via external message id if present (email), else platform-scoped.
  const externalMessageId = String(body?.data?.email_id ?? body?.email_id ?? body?.messageId ?? "");
  let tenantId = "platform";
  if (externalMessageId) {
    const msg = await prisma.message.findUnique({ where: { id: externalMessageId }, select: { tenantId: true } }).catch(() => null);
    if (msg) tenantId = msg.tenantId;
  }

  const existing = await prisma.webhookEvent.findUnique({ where: { externalEventId: eventId } }).catch(() => null);
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.webhookEvent.create({
    data: {
      tenantId,
      provider: "resend",
      externalEventId: eventId,
      processedAt: new Date(),
    },
  }).catch(() => {});

  await recordAudit({
    tenantId,
    actorType: "system",
    action: "webhook.received",
    category: "security",
    targetType: "webhook_event",
    targetId: eventId,
    metadata: { type, externalMessageId },
  }).catch(() => {});

  // Example handling: mark related message bounced/failed if provider reports it
  if (/bounce|fail/i.test(type) && externalMessageId) {
    const msg = await prisma.message.findUnique({ where: { id: externalMessageId } }).catch(() => null);
    if (msg && msg.status !== "sent") {
      await prisma.message.update({
        where: { id: externalMessageId },
        data: { status: "failed", meta: { ...(msg.meta as object ?? {}), webhookEvent: type } },
      });
    }
  }

  return NextResponse.json({ ok: true, received: true });
}

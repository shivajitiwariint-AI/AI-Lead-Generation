import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai-gateway";
import { recordAudit, recordLeadActivity, type ActorType } from "@/lib/activity";
import { getRealEstateConfig, buildOutreachFragment } from "@/lib/ai/real-estate";
import { getSoftwareConfig, buildOutreachFragment as buildSoftwareOutreachFragment } from "@/lib/ai/software-outreach";
import type { OperatingMode } from "@prisma/client";

/**
 * Requirement 6: full email lifecycle —
 * generate (AI) → review → edit → approve/reject → send.
 * The active operating mode (req 2) decides whether generation immediately
 * auto-approves (FULLY_AI_AUTOMATED), queues for review (AI_WITH_APPROVAL),
 * or stays a manual draft (FULLY_MANUAL).
 */

export function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export interface GenerateEmailOptions {
  tenantId: string;
  leadId: string;
  purpose?: "intro" | "follow_up";
  actorId?: string | null;
  actorType?: ActorType;
  attachments?: Array<{ name: string; url: string }>;
}

export interface GeneratedEmail {
  messageId: string;
  status: string;
  approvalRequired: boolean;
  subject: string;
  body: string;
  mock: boolean;
  mode: OperatingMode;
}

function extractJsonField(raw: string, field: "subject" | "body"): string | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed[field] === "string") return parsed[field];
  } catch {
    /* fall through */
  }
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i");
  const m = raw.match(re);
  if (m) {
    try {
      return JSON.parse(`"${m[1]}"`);
    } catch {
      return m[1];
    }
  }
  if (field === "body" && raw.trim() && !raw.trim().startsWith("{")) return raw.trim();
  return null;
}

export async function generateOutreachEmail(
  opts: GenerateEmailOptions
): Promise<GeneratedEmail> {
  const { tenantId, leadId } = opts;
  const purpose = opts.purpose ?? "intro";

  const lead = await prisma.lead.findFirst({ where: { id: leadId, tenantId } });
  if (!lead) throw new Error("Lead not found");
  if (!lead.email) throw new Error("Lead has no email address");

  const [tenant, profile, latestQualification] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.companyProfile.findUnique({ where: { tenantId } }),
    prisma.leadQualificationResult.findFirst({
      where: { leadId, tenantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!tenant) throw new Error("Tenant not found");

  const mode = tenant.operatingMode;
  const objectives = Array.isArray((profile as any)?.salesObjectives)
    ? ((profile as any).salesObjectives as any[])
        .map((o) => o?.objective)
        .filter(Boolean)
        .join("; ")
    : "";
  const matched = Array.isArray((latestQualification as any)?.matchedOffers)
    ? ((latestQualification as any).matchedOffers as any[]).filter((m) => m?.score >= 30)
    : [];
  const offer = matched[0]?.offer ?? "our solution";
  const reConfig = getRealEstateConfig(profile as any);
  const swConfig = getSoftwareConfig(profile as any);
  const website = (profile as any)?.website ? String((profile as any).website).trim() : "";
  const attachments = (opts.attachments ?? []).filter((a) => a.name.trim() && a.url.trim());

  const prompt = [
    `leadName: ${lead.name}`,
    `company: ${lead.company ?? "their company"}`,
    `industry: ${lead.industry ?? "unknown"}`,
    `offer: ${offer}`,
    `objective: ${objectives || "help teams convert more enquiries"}`,
    `purpose: ${purpose === "follow_up" ? "friendly follow-up after no response" : "first outreach introduction"}`,
    `requirement: ${lead.requirement ?? "not provided"}`,
    `recipient: ${lead.email}`,
    website ? `companyWebsite: ${website} — always include this link and politely ask the lead to review it` : "",
    attachments.length ? `attachments: ${attachments.map((a) => `${a.name} (${a.url})`).join(", ")} — mention them by name` : "",
    ...buildOutreachFragment(reConfig),
    ...buildSoftwareOutreachFragment(swConfig),
  ].filter(Boolean).join("\n");

  const ai = await generateText({
    moduleKey: "email_drafting",
    tenantId,
    prompt,
    systemPrompt:
      'You write short, personal B2B sales emails. Respond with ONLY JSON: {"subject": string (max 60 chars), "body": string (plain text, 90-140 words, no placeholders like [Name])}.',
    maxTokens: 900,
    temperature: 0.6,
  });

  const subject =
    extractJsonField(ai.text, "subject") || `Quick idea for ${lead.company || lead.name}`;
  let body =
    extractJsonField(ai.text, "body") ||
    `Hi ${lead.name.split(" ")[0]},\n\nThanks for your interest. I'd love to learn more about what you're looking for and share how we can help.\n\nWould a short call this week work?\n\nBest regards,\nSales Team`;

  // Ensure the company website is always present with a review CTA.
  if (website && !body.includes(website)) {
    body += `\n\nHave a look at our work: ${website}\nPlease review the link and let me know if you'd like a walkthrough — happy to tailor next steps to your needs.`;
  }
  if (attachments.length && !attachments.every((a) => body.includes(a.name))) {
    body += `\n\nAttachments: ${attachments.map((a) => `${a.name} — ${a.url}`).join("\n")}`;
  }

  // Approval gate: NEVER auto-approve. Every email needs explicit client
  // approval (Approve → Send) so no email is sent without sign-off.
  const status = "pending_review";

  const message = await prisma.message.create({
    data: {
      tenantId,
      leadId,
      channel: "email",
      direction: "outbound",
      status,
      subject: subject.slice(0, 500),
      body,
      toAddress: lead.email,
      fromAddress: null,
      generatedBy: "ai",
      approvedBy: null,
      approvedAt: null,
      meta: {
        purpose,
        mock: ai.mock,
        requestId: ai.requestId,
        model: ai.modelId,
        matchedOffer: matched[0] ?? null,
        mode,
        website: website || null,
        attachments: attachments.length ? attachments : undefined,
      },
    },
  });

  // AI + Human Approval mode: surface the draft in the approval queue
  if (status === "pending_review") {
    await prisma.approvalItem.create({
      data: {
        tenantId,
        itemType: "email",
        itemRefId: message.id,
        title: `Outreach email to ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
        summary: subject,
        payload: { messageId: message.id, leadId, to: lead.email, subject },
        status: "pending",
      },
    });
  }

  await Promise.all([
    recordLeadActivity({
      tenantId,
      leadId,
      actorId: opts.actorId ?? null,
      activityType: "email_generated",
      payload: { messageId: message.id, subject, status, mode, mock: ai.mock },
    }),
    recordAudit({
      tenantId,
      actorId: opts.actorId ?? null,
      actorType: "ai",
      action: "email.generated",
      category: "email",
      targetType: "message",
      targetId: message.id,
      metadata: {
        leadId,
        to: lead.email,
        subject,
        status,
        mode,
        mock: ai.mock,
        approvalRequired: status === "pending_review",
      },
    }),
  ]);

  return {
    messageId: message.id,
    status,
    approvalRequired: status === "pending_review",
    subject,
    body,
    mock: ai.mock,
    mode,
  };
}

async function decideApproval(params: {
  tenantId: string;
  messageId: string;
  actorId: string;
  decision: "approved" | "rejected";
  note?: string;
}) {
  const message = await prisma.message.findFirst({
    where: { id: params.messageId, tenantId: params.tenantId },
  });
  if (!message) throw new Error("Message not found");
  if (!["pending_review", "draft", "approved", "rejected"].includes(message.status)) {
    throw new Error(`Cannot ${params.decision} a message in status "${message.status}"`);
  }

  const updated = await prisma.message.update({
    where: { id: message.id },
    data:
      params.decision === "approved"
        ? {
            status: "approved",
            approvedBy: params.actorId,
            approvedAt: new Date(),
            rejectedBy: null,
            rejectedAt: null,
            rejectionReason: null,
          }
        : {
            status: "rejected",
            rejectedBy: params.actorId,
            rejectedAt: new Date(),
            rejectionReason: params.note?.slice(0, 500) ?? null,
            approvedBy: null,
            approvedAt: null,
          },
  });

  // Settle any matching approval queue item
  await prisma.approvalItem.updateMany({
    where: {
      tenantId: params.tenantId,
      itemType: "email",
      itemRefId: message.id,
      status: "pending",
    },
    data: {
      status: params.decision,
      decidedBy: params.actorId,
      decidedAt: new Date(),
      decisionNote: params.note?.slice(0, 500) ?? null,
    },
  });

  await Promise.all([
    message.leadId
      ? recordLeadActivity({
          tenantId: params.tenantId,
          leadId: message.leadId,
          actorId: params.actorId,
          activityType: params.decision === "approved" ? "email_approved" : "email_rejected",
          payload: { messageId: message.id, note: params.note ?? null },
        })
      : Promise.resolve(),
    recordAudit({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorType: "user",
      action: params.decision === "approved" ? "email.approved" : "email.rejected",
      category: "email",
      targetType: "message",
      targetId: message.id,
      metadata: { leadId: message.leadId, note: params.note ?? null },
    }),
  ]);

  return updated;
}

export const approveEmail = (p: { tenantId: string; messageId: string; actorId: string; note?: string }) =>
  decideApproval({ ...p, decision: "approved" });

export const rejectEmail = (p: { tenantId: string; messageId: string; actorId: string; note?: string }) =>
  decideApproval({ ...p, decision: "rejected" });

export interface SendEmailResult {
  sent: boolean;
  simulated: boolean;
  reason?: string;
  sentAt?: Date;
}

/**
 * Send an approved email.
 * Priority: 1) per-company SMTP config (admin-managed) → 2) Resend env key →
 * 3) simulated send (demos). Suppression-list entries always block sending.
 */
export async function sendEmail(params: {
  tenantId: string;
  messageId: string;
  actorId?: string | null;
  actorType?: ActorType;
}): Promise<SendEmailResult> {
  const { tenantId, messageId } = params;

  const message = await prisma.message.findFirst({
    where: { id: messageId, tenantId },
  });
  if (!message) throw new Error("Message not found");
  if (message.status === "sent") return { sent: true, simulated: !!message.meta, sentAt: message.sentAt ?? undefined };
  if (message.status !== "approved") {
    throw new Error(`Email must be approved before sending (current: ${message.status})`);
  }
  if (!message.toAddress) throw new Error("Missing recipient address");

  // Suppression check (security/compliance, req 11 surface)
  const suppressed = await prisma.suppressionEntry.findFirst({
    where: { tenantId, contactHash: emailHash(message.toAddress), channel: "email" },
  });
  if (suppressed) {
    await recordAudit({
      tenantId,
      actorId: params.actorId ?? null,
      actorType: params.actorType ?? "system",
      action: "email.blocked_suppressed",
      category: "security",
      targetType: "message",
      targetId: messageId,
      metadata: { to: message.toAddress, reason: suppressed.reason },
    });
    return { sent: false, simulated: false, reason: `Recipient suppressed: ${suppressed.reason}` };
  }

  let simulated = true;
  let providerUsed = "local";
  const smtpConfig = await prisma.smtpConfig.findUnique({ where: { tenantId } });
  if (smtpConfig?.enabled) {
    try {
      const { sendViaSmtp } = await import("@/lib/smtp");
      await sendViaSmtp(tenantId, {
        to: message.toAddress,
        subject: message.subject || "(no subject)",
        text: message.body || "",
      });
      simulated = false;
      providerUsed = "smtp";
    } catch (err) {
      console.error("[email] SMTP failed:", (err as Error).message);
      throw err;
    }
  } else {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: message.fromAddress || "AI Lead Gen <onboarding@resend.dev>",
          to: [message.toAddress],
          subject: message.subject || "(no subject)",
          html: (message.body || "").replace(/\n/g, "<br/>"),
        }),
      });
      if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      simulated = false;
      providerUsed = "resend";
    } catch (err) {
      console.error("[email] resend failed, marking simulated:", (err as Error).message);
      simulated = true;
    }
  }
  }

  const sentAt = new Date();
  await prisma.message.update({
    where: { id: messageId },
    data: {
      status: "sent",
      sentAt,
      fromAddress: smtpConfig?.enabled ? smtpConfig.fromEmail : message.fromAddress,
      meta: { ...(message.meta as object ?? {}), simulated, provider: providerUsed },
    },
  });

  if (message.leadId) {
    await prisma.lead.update({
      where: { id: message.leadId },
      data: { lastContactedAt: sentAt, lastAiActionAt: sentAt },
    });
    await recordLeadActivity({
      tenantId,
      leadId: message.leadId,
      actorId: params.actorId ?? null,
      activityType: "email_sent",
      payload: { messageId, to: message.toAddress, subject: message.subject, simulated },
    });
  }

  await recordAudit({
    tenantId,
    actorId: params.actorId ?? null,
    actorType: params.actorType ?? "ai",
    action: "email.sent",
    category: "email",
    targetType: "message",
    targetId: messageId,
    metadata: {
      to: message.toAddress,
      subject: message.subject,
      leadId: message.leadId,
      simulated,
    },
  });

  return { sent: true, simulated, sentAt };
}

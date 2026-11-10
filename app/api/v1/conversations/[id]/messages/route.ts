export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/ai-gateway";
import { recordAudit, recordLeadActivity } from "@/lib/activity";
import { retrieveTenantRag } from "@/lib/rag";
import { stripDemoWording } from "@/lib/public-guardrails";
import { checkSharedRateLimit } from "@/lib/rate-limit";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]).optional(),
  content: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  action: z.enum(["handoff"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  const rl = await checkSharedRateLimit(
    [`conv-chat:tenant:${ctx.tenantId ?? ctx.userId}`, `conv-chat:user:${ctx.userId}`],
    30,
    60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many chat requests — wait a minute and try again." } },
      { status: 429, headers: { "X-RateLimit-Remaining": String(rl.remaining), "X-RateLimit-Reset": String(rl.resetAt) } }
    );
  }

  try {
    const body = await req.json();
    const data = messageSchema.parse(body);

    if (data.action === "handoff") {
      const conversation = await prisma.conversation.update({
        where: { id: params.id, tenantId: ctx.tenantId! },
        data: { status: "handoff_requested" },
      });
      await recordAudit({
        tenantId: ctx.tenantId!,
        actorId: ctx.userId,
        actorType: "user",
        action: "conversation.handoff_requested",
        category: "lead",
        targetType: "conversation",
        targetId: params.id,
      });
      return NextResponse.json(conversation);
    }

    if (!data.role || !data.content) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "role and content are required" } },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.create({
      data: {
        tenantId: ctx.tenantId!,
        conversationId: params.id,
        role: data.role,
        content: data.content,
        metadata: data.metadata ?? {},
      },
    });

    await prisma.conversation.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    });

    // Requirement 9: AI conversations — generate an assistant reply.
    if (data.role === "user") {
      const conversation = await prisma.conversation.findFirst({
        where: { id: params.id, tenantId: ctx.tenantId! },
      });
      if (conversation && conversation.status !== "handoff_requested") {
        const recent = await prisma.chatMessage.findMany({
          where: { conversationId: params.id, tenantId: ctx.tenantId! },
          orderBy: { createdAt: "desc" },
          take: 8,
        });
        const history = recent
          .reverse()
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n");
        const rag = await retrieveTenantRag(ctx.tenantId!, data.content, 4);
        const ai = await generateText({
          moduleKey: "chatbot",
          tenantId: ctx.tenantId!,
          prompt: `Retrieved context:\n${rag.context}\n\nConversation so far:\n${history}\n\nLatest user message: ${data.content}\nReply helpfully and concisely as a sales assistant, grounded in the retrieved context. If the user wants a meeting/call, propose two time slots and ask them to confirm one.`,
          systemPrompt:
            "You are a helpful AI sales assistant for a B2B company. Answer only from the retrieved context and conversation. Be concise, friendly and ask one clarifying question when useful. Never invent company facts.",
          maxTokens: 500,
          temperature: 0.5,
        });
        const reply = await prisma.chatMessage.create({
          data: {
            tenantId: ctx.tenantId!,
            conversationId: params.id,
            role: "assistant",
            content: stripDemoWording(ai.text),
            metadata: {
              mock: ai.mock,
              requestId: ai.requestId,
              model: ai.modelId,
              ragSources: rag.hits.map((h) => ({ source: h.source, title: h.title })),
            },
          },
        });

        // Meeting scheduling (req 9)
        const lower = data.content.toLowerCase();
        if (/(meeting|call|schedule|calendar|book)/.test(lower)) {
          if (conversation.leadId) {
            const lead = await prisma.lead.findFirst({
              where: { id: conversation.leadId, tenantId: ctx.tenantId! },
            });
            if (lead) {
              const existing = await prisma.meeting.findFirst({
                where: { tenantId: ctx.tenantId!, leadId: lead.id, status: { in: ["proposed", "scheduled"] } },
              });
              if (!existing) {
                const starts = new Date();
                starts.setDate(starts.getDate() + 2);
                starts.setHours(10, 0, 0, 0);
                const ends = new Date(starts);
                ends.setMinutes(ends.getMinutes() + 30);
                const m = await prisma.meeting.create({
                  data: {
                    tenantId: ctx.tenantId!,
                    leadId: lead.id,
                    title: `Discovery call — ${lead.name}`,
                    startsAt: starts,
                    endsAt: ends,
                    status: "proposed",
                    notes: "Proposed during AI conversation. Awaiting confirmation.",
                    createdBy: "ai",
                  },
                });
                await recordLeadActivity({
                  tenantId: ctx.tenantId!,
                  leadId: lead.id,
                  actorId: ctx.userId,
                  activityType: "meeting_proposed",
                  payload: { meetingId: m.id, source: "conversation", conversationId: params.id },
                });
              }
            }
          }
        }

        await recordAudit({
          tenantId: ctx.tenantId!,
          actorId: ctx.userId,
          actorType: "ai",
          action: "chat.replied",
          category: "ai",
          targetType: "conversation",
          targetId: params.id,
          metadata: { mock: ai.mock, model: ai.modelId },
        });

        return NextResponse.json({ userMessage: message, assistantMessage: reply }, { status: 201 });
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
      { status: 401 }
    );
  }
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: params.id, tenantId: ctx.tenantId! },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json(messages);
}

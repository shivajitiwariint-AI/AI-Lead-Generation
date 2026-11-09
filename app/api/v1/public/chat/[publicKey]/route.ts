export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveTenantRag } from "@/lib/rag";
import { isBlockedRequest, sanitizeOutput, SAFE_REFUSAL } from "@/lib/public-guardrails";
import { generateText } from "@/lib/ai-gateway";
import { isAIEnabled } from "@/lib/ai/settings";

const RATE_LIMIT = 30;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_LIMIT;
}

async function loadBot(publicKey: string) {
  return prisma.chatbot.findUnique({ where: { publicKey } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { publicKey: string } }
) {
  const bot = await loadBot(params.publicKey);
  if (!bot || bot.status !== "active") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Bot not found or inactive" } }, { status: 404 });
  }
  const settings = (bot.settings ?? {}) as Record<string, any>;
  return NextResponse.json({
    name: bot.name,
    status: bot.status,
    welcomeMessage: settings.welcomeMessage ?? `Hi! I'm ${bot.name}. Ask me about our services.`,
    leadCaptureEnabled: settings.leadCaptureEnabled !== false,
    useKnowledgeBase: settings.useKnowledgeBase !== false,
    usePublicDocs: settings.usePublicDocs !== false,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { publicKey: string } }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ answer: "Too many requests — please wait a few minutes." }, { status: 429 });
  }

  const bot = await loadBot(params.publicKey);
  if (!bot || bot.status !== "active") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Bot not found or inactive" } }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? body?.content ?? "").trim();
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!message || message.length < 2) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Message required" } }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Keep messages under 500 characters" } }, { status: 400 });
  }

  if (isBlockedRequest(message)) {
    return NextResponse.json({ answer: SAFE_REFUSAL, sources: [], blocked: true });
  }

  const settings = (bot.settings ?? {}) as Record<string, any>;
  const useKB = settings.useKnowledgeBase !== false;
  const rag = useKB
    ? await retrieveTenantRag(bot.tenantId, message, 4)
    : { hits: [] as never[], context: "" };
  const sources = rag.hits.map((h: any) => ({ title: h.title }));

  if (!(await isAIEnabled())) {
    return NextResponse.json({
      answer: rag.hits.length ? rag.hits[0].content : SAFE_REFUSAL,
      sources,
      fallback: true,
      chatbot: { id: bot.id, name: bot.name },
    });
  }

  const turnText = history.slice(-4).map((m: any) => `${m.role ?? "user"}: ${String(m.content ?? "").slice(0, 800)}`).join("\n");
  const prompt = `Bot: ${bot.name}\nContext:\n${rag.context || "No matching knowledge. Answer from general public info."}\n\n${turnText ? `History:\n${turnText}\n\n` : ""}Visitor: ${message}`;

  try {
    const out = await generateText({
      moduleKey: "chatbot",
      tenantId: bot.tenantId,
      prompt,
      systemPrompt:
        "You are the website assistant for this business. Answer only from the retrieved context. Keep it short and helpful. If the visitor asks for private/internal info, politely decline.",
      maxTokens: 700,
      temperature: 0.3,
    });

    if (out.mock || !out.text.trim()) {
      return NextResponse.json({
        answer: rag.hits.length ? rag.hits[0].content : "Thanks for reaching out! How can I help you today?",
        sources,
        fallback: true,
        chatbot: { id: bot.id, name: bot.name },
      });
    }

    const { clean, blocked } = sanitizeOutput(out.text.trim());
    return NextResponse.json({ answer: clean, sources, blocked, chatbot: { id: bot.id, name: bot.name } });
  } catch {
    return NextResponse.json({
      answer: rag.hits.length ? rag.hits[0].content : SAFE_REFUSAL,
      sources,
      fallback: true,
      chatbot: { id: bot.id, name: bot.name },
    });
  }
}

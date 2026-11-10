export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { retrievePublicDocsFromDB, publicContext } from "@/lib/public-knowledge";
import { isBlockedRequest, sanitizeOutput, SYSTEM_PROMPT, SAFE_REFUSAL } from "@/lib/public-guardrails";
import { generateText } from "@/lib/ai-gateway";
import { isAIEnabled } from "@/lib/ai/settings";

const RATE_LIMIT = 30; // req / 10 min per IP
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { answer: "Too many requests — please wait a few minutes and try again.", sources: [] },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!message || message.length < 2) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Message is required." } }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Keep messages under 500 characters." } }, { status: 400 });
  }
  if (history.length > 12) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Conversation too long." } }, { status: 400 });
  }
  const cleanHistory: Array<{ role: string; content: string }> = [];
  for (const m of history) {
    if (typeof m?.role !== "string" || typeof m?.content !== "string") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid history entry." } }, { status: 400 });
    }
    const role = m.role === "assistant" || m.role === "user" ? m.role : "user";
    const content = m.content.trim().slice(0, 800);
    if (!content) continue;
    cleanHistory.push({ role, content });
  }

  if (isBlockedRequest(message)) {
    return NextResponse.json({ answer: SAFE_REFUSAL, sources: [], blocked: true });
  }

  const docs = await retrievePublicDocsFromDB(message);
  const sources = docs.map((d) => ({ id: d.id, title: d.title }));
  const ctx = publicContext(docs);

  if (!(await isAIEnabled())) {
    return NextResponse.json({
      answer: docs.length ? docs[0].content : SAFE_REFUSAL,
      sources,
      fallback: true,
    });
  }

  const turnText = cleanHistory
    .slice(-4)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const prompt = `Public context:\n${ctx || "No matching public information."}\n\n${turnText ? `Conversation so far:\n${turnText}\n\n` : ""}Question: ${message}`;

  try {
    const out = await generateText({
      moduleKey: "chatbot",
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 700,
      temperature: 0.3,
    });

    if (out.mock || !out.text.trim()) {
      // Deterministic fallback from retrieved public docs only
      return NextResponse.json({
        answer: docs.length
          ? `${docs[0].content} ${docs[1] ? docs[1].content : ""}`.trim()
          : "I can help with our public services, features, and how the platform helps sales teams. Could you tell me what you're interested in — for example, how lead scoring works, or how to get started?",
        sources,
        fallback: true,
      });
    }

    const { clean, blocked } = sanitizeOutput(out.text.trim());
    return NextResponse.json({ answer: clean, sources, blocked });
  } catch {
    return NextResponse.json({
      answer: docs.length ? docs[0].content : SAFE_REFUSAL,
      sources,
      fallback: true,
    });
  }
}

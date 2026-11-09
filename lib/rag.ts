import { prisma } from "@/lib/prisma";
import { retrievePublicDocsFromDB, publicContext, type PublicDoc } from "@/lib/public-knowledge";

export interface RagHit {
  source: "knowledge-base" | "public-doc";
  title: string;
  content: string;
}

function scoreText(query: string, hay: string) {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let s = 0;
  const lower = hay.toLowerCase();
  for (const w of words) if (lower.includes(w)) s += 1;
  return s;
}

export async function retrieveTenantRag(
  tenantId: string,
  query: string,
  topN = 4
): Promise<{ hits: RagHit[]; context: string }> {
  const hits: RagHit[] = [];

  // 1) Tenant Knowledge Base chunks (keyword retrieval)
  try {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { tenantId },
      take: 100,
      orderBy: { createdAt: "desc" },
    });
    const scored = chunks
      .map((c) => ({ c, score: scoreText(query, c.content) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    for (const s of scored) {
      hits.push({
        source: "knowledge-base",
        title: `Knowledge chunk ${s.c.chunkIndex + 1}`,
        content: s.c.content.slice(0, 800),
      });
    }
  } catch {
    /* ignore */
  }

  // 2) Admin-managed public docs
  try {
    const docs: PublicDoc[] = await retrievePublicDocsFromDB(query, 3);
    for (const d of docs) {
      hits.push({ source: "public-doc", title: d.title, content: d.content });
    }
  } catch {
    /* ignore */
  }

  const context =
    hits.length > 0
      ? hits.map((h) => `[${h.title}] ${h.content}`).join("\n\n")
      : "No retrieved context. Answer from general sales knowledge without inventing company facts.";

  return { hits: hits.slice(0, topN + 3), context };
}

export function ragContextText(hits: RagHit[]): string {
  return publicContext(hits.map((h) => ({ id: h.title, title: h.title, keywords: [], content: h.content })));
}

export interface PublicDoc {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

/**
 * Approved PUBLIC-ONLY knowledge for the homepage RAG assistant.
 * Contains ONLY marketing-level information about services, features
 * and value. Never add API keys, credentials, architecture, database
 * structure, source code, or behind-login internals here.
 */
export const PUBLIC_DOCS: PublicDoc[] = [
  {
    id: "overview",
    title: "What AI Lead Gen is",
    keywords: ["what", "service", "product", "platform", "about", "ai lead gen"],
    content:
      "AI Lead Gen is a multi-tenant AI sales automation platform that helps sales teams capture, score, and engage leads end-to-end. You choose how autonomous it is: fully automated, AI-drafted with human approval, or fully manual. Start with a free trial and explore the platform with your own data.",
  },
  {
    id: "features-scoring",
    title: "AI Lead Scoring",
    keywords: ["scoring", "score", "qualify", "hot", "warm", "rank", "prioriti"],
    content:
      "Every enquiry is scored against your ideal customer profile (fit, intent, urgency, completeness). Hot leads get routed first, medium leads enter nurture, cold leads get informational material. Your team works the hottest opportunities first instead of chasing spreadsheets.",
  },
  {
    id: "features-chatbot",
    title: "Website Chatbot",
    keywords: ["chatbot", "website", "visitor", "qualify", "capture", "24/7"],
    content:
      "The website chatbot qualifies visitors 24/7, captures contact details, and hands over structured leads automatically. It answers common questions, collects name and email, and books a meeting when the visitor is ready.",
  },
  {
    id: "features-pipeline",
    title: "Pipeline Visibility",
    keywords: ["pipeline", "track", "stage", "won", "lost", "reporting", "conversion"],
    content:
      "Track every opportunity from first touch to won in a live pipeline. See conversion by stage, which leads are stalled, and what to do next. No more guessing what happened to a lead.",
  },
  {
    id: "features-followups",
    title: "Automated Follow-ups",
    keywords: ["follow", "reminder", "outreach", "email", "nurture", "sequence"],
    content:
      "Smart reminders and multi-channel follow-up sequences make sure no lead goes cold. AI drafts personalized outreach — you approve it, or let the platform send it automatically depending on your chosen mode.",
  },
  {
    id: "how-it-works",
    title: "How it works",
    keywords: ["how", "work", "step", "process", "capture", "qualify", "engage"],
    content:
      "Three steps: 1) Capture — forms, CSV imports, chatbot and manual entry in one place. 2) Qualify — AI scoring and requirements matching rank every lead. 3) Engage — campaigns, personalized emails, meetings and follow-ups move qualified leads to a decision. The header bell and Live Activity page tell you when AI finishes.",
  },
  {
    id: "modes",
    title: "Automation modes",
    keywords: ["mode", "automated", "approval", "manual", "pause", "takeover", "control"],
    content:
      "You control automation: Fully AI Automated sends without waiting, AI + Human Approval drafts for review first, Fully Manual disables AI actions. You can pause all AI instantly with the Manual Takeover switch, and take over individual leads at any time. Every action is logged in Activity.",
  },
  {
    id: "real-estate",
    title: "Real Estate value",
    keywords: ["real estate", "property", "flat", "apartment", "investor", "buyer", "broker"],
    content:
      "For real estate teams the assistant discovers property buyers, investors, brokers and agencies, qualifies them by profession and investment intent, drafts short personalized outreach (highlighting premium locations, ready-to-move flats, site visits and pricing benefits), and proposes discovery calls for high scorers.",
  },
  {
    id: "software",
    title: "Software agency value",
    keywords: ["software", "website", "erp", "dashboard", "agency", "school", "clinic", "business"],
    content:
      "For software agencies the assistant finds local businesses with outdated websites or no digital systems (schools, clinics, wholesalers, factories, startups), scores them by scaling potential and visible contact details, and pitches website modernization, dashboards, ERP, inventory and cloud deployment in a short, human-like tone.",
  },
  {
    id: "pricing-plans",
    title: "Pricing and plans",
    keywords: ["price", "pricing", "cost", "trial", "quote", "plan"],
    content:
      "Pricing depends on team size and usage — plans start small and scale as you grow. Start a free trial and a specialist will send a tailored quote. No credit card is needed to get started.",
  },
  {
    id: "security-privacy",
    title: "Security and privacy",
    keywords: ["security", "secure", "privacy", "data", "consent", "compliant", "audit"],
    content:
      "Each workspace is fully isolated with role-based access. Consent tracking, suppression lists, and full audit logs are built in. The public assistant explains public features only; anything behind login stays private.",
  },
];

export function retrieveFromList(docs: PublicDoc[], query: string, topN = 3): PublicDoc[] {
  const normalized = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter(
      (w) =>
        !["what", "how", "does", "about", "please", "tell", "more", "there", "this", "that", "with", "from", "have", "your", "our", "for"].includes(w)
    );
  const scored = docs.map((doc) => {
    let score = 0;
    const hay = (doc.title + " " + doc.keywords.join(" ") + " " + doc.content).toLowerCase();
    for (const w of normalized) {
      if (hay.includes(w)) score += 2;
      for (const kw of doc.keywords) {
        if (kw.includes(w) || w.includes(kw)) score += 3;
      }
    }
    return { doc, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((s) => s.doc);
}

export function retrievePublicDocs(query: string, topN = 3): PublicDoc[] {
  return retrieveFromList(PUBLIC_DOCS, query, topN);
}

export async function retrievePublicDocsFromDB(query: string, topN = 3): Promise<PublicDoc[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.publicDoc.findMany({ where: { enabled: true } });
    if (!rows.length) return retrievePublicDocs(query, topN);
    const docs: PublicDoc[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      keywords: Array.isArray(r.keywords) ? (r.keywords as string[]) : [],
      content: r.content,
    }));
    const hit = retrieveFromList(docs, query, topN);
    return hit.length ? hit : retrievePublicDocs(query, topN);
  } catch {
    return retrievePublicDocs(query, topN);
  }
}

export function publicContext(docs: PublicDoc[]): string {
  return docs.map((d) => `[${d.title}] ${d.content}`).join("\n\n");
}

import type { AIModuleKey } from "@/lib/ai-gateway";

/**
 * Deterministic local engine used when no API key is configured for a module.
 * Produces structured, plausible output so every AI feature (qualification,
 * matching, research, email drafting, chat, summaries) works end-to-end in
 * local runs and tests without external credentials. Output always states that it
 * was generated locally via the `generatedBy: "mock"` marker in metadata.
 */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** Very small token estimate (≈ 4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function extractField(prompt: string, label: string): string | null {
  const m = prompt.match(new RegExp(`${label}\\s*[:=]\\s*([^\\n|]+)`, "i"));
  return m ? m[1].trim().replace(/[.,;]$/, "") : null;
}

const COMPANY_NAME_POOL = [
  "Nimbus Logistics", "Harborview Realty", "Crestline Manufacturing",
  "Bluepeak Software", "Verde Organic Farms", "Atlas Financial Group",
  "Skyline Dental Partners", "Ironwood Construction", "Lumen Retail Group",
  "QuickCart E-commerce", "Solstice Energy", "Maple & Co Hospitality",
];

const CONTACT_POOL = [
  ["Priya Sharma", "Head of Operations"],
  ["Daniel Okafor", "Managing Director"],
  ["Elena Rodriguez", "Procurement Lead"],
  ["Marcus Webb", "VP Sales"],
  ["Aiko Tanaka", "Founder"],
  ["Liam O'Connor", "IT Manager"],
];

function slugEmail(name: string, company: string): string {
  const first = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  const dom = company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "example";
  return `${first}@${dom}.com`;
}

export function mockGenerate(
  moduleKey: AIModuleKey,
  prompt: string,
  _systemPrompt?: string
): string {
  const seed = hash(prompt + moduleKey);

  switch (moduleKey) {
    case "lead_qualification": {
      const fit = 55 + (seed % 40);
      const intent = 40 + ((seed >> 3) % 55);
      const urgency = 30 + ((seed >> 5) % 65);
      const completeness = 45 + ((seed >> 7) % 50);
      const overall = Math.round(fit * 0.35 + intent * 0.3 + urgency * 0.2 + completeness * 0.15);
      const requirement = extractField(prompt, "Requirement") || extractField(prompt, "requirement") || "";
      const industry = extractField(prompt, "Industry") || "unknown industry";
      const summary =
        `Prospect in ${industry} shows ${overall >= 70 ? "strong" : overall >= 50 ? "moderate" : "limited"} buying signals. ` +
        (requirement
          ? `Stated need "${requirement.slice(0, 80)}" aligns with the offer catalog. `
          : "") +
        `Data completeness is ${completeness >= 70 ? "good" : "partial"}${completeness < 70 ? " — request company size and timeline to improve scoring" : ""}.`;
      const nextAction =
        overall >= 70
          ? "Prioritise: draft a personalised outreach email and propose a discovery call."
          : overall >= 50
            ? "Nurture: send informational follow-up and re-qualify in 5 days."
            : "Deprioritise: add to long-term nurture; revisit if engagement increases.";
      return JSON.stringify(
        {
          fitScore: fit,
          intentScore: intent,
          urgencyScore: urgency,
          completenessScore: completeness,
          overallScore: overall,
          confidence: overall >= 65 ? "high" : "medium",
          summary,
          nextAction,
          generatedBy: "mock",
        },
        null,
        2
      );
    }

    case "company_research": {
      const upToMatch = prompt.match(/up to\s+(\d+)/i);
      const count = Math.min(Math.max(upToMatch ? Number(upToMatch[1]) : 3 + (seed % 3), 1), 20);
      const industry = extractField(prompt, "Industry focus") || extractField(prompt, "Industry") || extractField(prompt, "industry") || "technology";
      const location = extractField(prompt, "Location") || "target market";
      const candidates = [];
      for (let i = 0; i < count; i++) {
        const s = seed + i * 7919;
        const company = COMPANY_NAME_POOL[s % COMPANY_NAME_POOL.length];
        const contactEntry = CONTACT_POOL[s % CONTACT_POOL.length];
        const contact = contactEntry[0];
        const title = contactEntry[1];
        candidates.push({
          name: contact,
          title: title,
          company: company,
          email: slugEmail(contact, company),
          phone: `+1 (555) ${String(100 + (s % 900))}-${String(1000 + (s % 9000))}`,
          website: `https://${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
          industry: industry,
          location: location,
          reason: `Company profile matches target criteria in ${industry}; ${title.toLowerCase()} is the typical decision-maker for this offer.`,
          sourceConfidence: 0.7 + ((s % 25) / 100),
          generatedBy: "mock",
        });
      }
      return JSON.stringify({ candidates: candidates }, null, 2);
    }

    case "email_drafting": {
      const name = extractField(prompt, "leadName") || extractField(prompt, "Lead") || "there";
      const company = extractField(prompt, "company") || extractField(prompt, "Company") || "your company";
      const offer = extractField(prompt, "offer") || extractField(prompt, "matched offer") || "our solutions";
      const objective =
        extractField(prompt, "objective") ||
        extractField(prompt, "salesObjective") ||
        "help teams convert more enquiries";
      const firstName = name.split(" ")[0];
      const subject = [
        `Quick idea for ${company}`,
        `${offer} — a practical next step for ${company}`,
        `Helping ${company} ${objective}`,
      ][seed % 3];
      const body = `Hi ${firstName},

I came across ${company} and noticed you may be exploring ways to ${objective}.

We help teams like yours with ${offer} — typically saving hours of manual work in the first month while improving response times to new enquiries.

Would a 20-minute call this week make sense to walk through how this would fit ${company}'s setup? I can share a short, tailored plan either way.

Best regards,
Sales Team

—
You are receiving this because your details were captured with consent. Reply STOP to opt out.`;
      return JSON.stringify({ subject, body, generatedBy: "mock" }, null, 2);
    }

    case "chatbot": {
      const question = prompt.trim().split("\n").pop() || prompt;
      const lower = question.toLowerCase();
      if (/(price|cost|pricing|quote)/.test(lower)) {
        return "Thanks for asking! Pricing depends on team size and usage — plans typically start small and scale as you grow. I can have a specialist send you a tailored quote. Could you share your name, company and email?";
      }
      if (/(trial|try|get started|sign up)/.test(lower)) {
        return "Absolutely — you can start a free trial and explore the platform with your own data. What does your team look like (number of sales people), and which industry are you in? I'll point you to the right setup.";
      }
      if (/(meeting|call|calendar|schedule)/.test(lower)) {
        return "I can arrange that. What day and time works best for you this week, and what's the best email to send the invite to?";
      }
      if (/(feature|does it|can it|how does)/.test(lower)) {
        return "Great question. In short: we capture leads from your site, score them with AI, match them to your offers, draft outreach emails for review, and track every step. Which area is most relevant to you?";
      }
      return `Thanks for reaching out! Regarding "${question.slice(0, 90)}" — happy to help. Could you tell me a bit about your company and what you're trying to achieve? That way I can give you an accurate answer or connect you with the right person.`;
    }

    case "conversation_summary": {
      const lines = prompt.split("\n").filter(Boolean).slice(-6);
      return `Summary: visitor engaged with ${lines.length} message(s) and expressed interest. Intent: ${seed % 2 ? "high" : "medium"}. Recommended next step: capture contact details and schedule a follow-up. (locally generated summary)`;
    }

    case "lead_extraction": {
      const name = extractField(prompt, "name") || "Extracted Contact";
      const company = extractField(prompt, "company") || null;
      const email = extractField(prompt, "email") || null;
      return JSON.stringify(
        { name, company, email, phone: extractField(prompt, "phone") || null, extractedBy: "mock" },
        null,
        2
      );
    }

    case "complex_analysis":
    case "embeddings":
    default: {
      return `Local analysis (${moduleKey}): key factors identified — fit, intent and timing. Overall recommendation: prioritise qualified prospects and schedule follow-ups within 48 hours. (generated locally without an external model)`;
    }
  }
}

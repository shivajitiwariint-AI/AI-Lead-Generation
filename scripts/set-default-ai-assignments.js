/**
 * Apply Groq (primary) + Ollama (fallback) to every AI module for the platform
 * default and every company workspace. Safe to run more than once.
 *
 * Usage: node scripts/set-default-ai-assignments.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MODULE_KEYS = [
  "chatbot",
  "lead_extraction",
  "lead_qualification",
  "company_research",
  "complex_analysis",
  "email_drafting",
  "conversation_summary",
  "embeddings",
];

(async () => {
  const [groq, ollama] = await Promise.all([
    prisma.aIProvider.findUnique({ where: { providerKey: "groq" } }),
    prisma.aIProvider.findUnique({ where: { providerKey: "ollama" } }),
  ]);

  if (!groq || !groq.enabled) throw new Error("Groq provider is missing or disabled");
  if (!ollama || !ollama.enabled) throw new Error("Ollama provider is missing or disabled");

  const [groqModels, ollamaModels] = await Promise.all([
    prisma.aIModel.findMany({ where: { providerId: groq.id, enabled: true } }),
    prisma.aIModel.findMany({ where: { providerId: ollama.id, enabled: true } }),
  ]);

  const primary =
    groqModels.find((m) => m.modelKey === "openai/gpt-oss-120b") ?? groqModels[0];
  const fallback =
    ollamaModels.find((m) => m.modelKey === "qwen3:8b") ??
    ollamaModels.find((m) => m.modelKey === "llama3.2:latest") ??
    ollamaModels[0];

  if (!primary) throw new Error("No enabled Groq model found");
  if (!fallback) throw new Error("No enabled Ollama model found");

  const companies = await prisma.tenant.findMany({
    where: { slug: { not: "platform" } },
    select: { id: true, name: true },
  });
  const scopes = ["platform", ...companies.map((c) => c.id)];

  for (const scope of scopes) {
    for (const moduleKey of MODULE_KEYS) {
      await prisma.aIModuleAssignment.upsert({
        where: { tenantId_moduleKey: { tenantId: scope, moduleKey } },
        update: {
          modelId: primary.id,
          fallbackModelId: fallback.id,
          updatedAt: new Date(),
        },
        create: {
          tenantId: scope,
          moduleKey,
          modelId: primary.id,
          fallbackModelId: fallback.id,
        },
      });
    }
  }

  // Platform-wide token/cost budget used by the "token availability" check.
  const budget = await prisma.aIBudget.findFirst({ where: { tenantId: null } });
  if (!budget) {
    await prisma.aIBudget.create({
      data: {
        tenantId: null,
        monthlyTokenLimit: 1000000,
        monthlyCostLimit: 50,
        alertThreshold: 0.8,
        enforce: false,
      },
    });
  }

  console.log("Default AI assignments applied.");
  console.log(`Primary : ${groq.displayName} / ${primary.displayName} (${primary.modelKey})`);
  console.log(`Fallback: ${ollama.displayName} / ${fallback.displayName} (${fallback.modelKey})`);
  console.log(`Scopes  : ${scopes.length} (platform + ${companies.map((c) => c.name).join(", ") || "no companies"})`);
  console.log(`Budget  : ${budget ? "existing" : "created 1,000,000 tokens / $50 per month (not enforced)"}`);
})()
  .catch((e) => {
    console.error("Failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

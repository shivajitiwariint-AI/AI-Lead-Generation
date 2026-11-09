const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();

async function callProvider(providerKey, modelKey) {
  const started = Date.now();
  if (providerKey === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelKey,
        temperature: 0,
        max_tokens: 256,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`groq ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      latency: Date.now() - started,
    };
  }
  if (providerKey === "ollama") {
    const base = (env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelKey,
        stream: false,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`ollama ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    return {
      text: data.message?.content ?? "",
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
      latency: Date.now() - started,
    };
  }
  throw new Error(`unsupported ${providerKey}`);
}

(async () => {
  const companies = await prisma.tenant.findMany({ where: { slug: { not: "platform" } } });
  const scopes = ["platform", ...companies.map((c) => c.id)];
  const assignments = await prisma.aIModuleAssignment.findMany();
  const models = await prisma.aIModel.findMany();
  const providers = await prisma.aIProvider.findMany();
  const modelById = Object.fromEntries(models.map((m) => [m.id, m]));
  const providerById = Object.fromEntries(providers.map((p) => [p.id, p]));

  console.log("=== ASSIGNMENTS BY SCOPE ===");
  for (const scope of scopes) {
    const rows = assignments.filter((a) => a.tenantId === scope);
    console.log(`${scope}: ${rows.length} modules`);
    for (const a of rows) {
      const p = modelById[a.modelId];
      const f = a.fallbackModelId ? modelById[a.fallbackModelId] : null;
      console.log(
        `  ${a.moduleKey}: ${p?.modelKey} (${providerById[p?.providerId]?.providerKey}) / fallback ${f?.modelKey ?? "none"}`
      );
    }
  }

  console.log("\n=== LIVE MODEL TESTS ===");
  const unique = new Map();
  for (const a of assignments) {
    for (const id of [a.modelId, a.fallbackModelId]) {
      if (id && modelById[id]) {
        const m = modelById[id];
        unique.set(id, { modelKey: m.modelKey, providerKey: providerById[m.providerId]?.providerKey });
      }
    }
  }
  for (const [id, m] of unique) {
    try {
      const out = await callProvider(m.providerKey, m.modelKey);
      console.log(
        `OK   ${m.providerKey}/${m.modelKey} -> "${out.text.trim()}" | ${out.latency}ms | in ${out.inputTokens}, out ${out.outputTokens}`
      );
    } catch (e) {
      console.log(`FAIL ${m.providerKey}/${m.modelKey} -> ${e.message}`);
    }
  }

  console.log("\n=== BUDGET ===");
  const budget = await prisma.aIBudget.findFirst({ where: { tenantId: null } });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  for (const scope of scopes) {
    const [usage, cost] = await Promise.all([
      prisma.aIUsageLog.aggregate({
        where: { tenantId: scope, createdAt: { gte: monthStart } },
        _sum: { inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      prisma.aICostLog.aggregate({
        where: { tenantId: scope, createdAt: { gte: monthStart } },
        _sum: { estimatedCost: true },
      }),
    ]);
    const tokens = (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0);
    console.log(
      `${scope}: ${tokens} tokens used / ${budget?.monthlyTokenLimit ?? "no limit"} | $${Number(cost._sum.estimatedCost ?? 0).toFixed(4)} / $${budget?.monthlyCostLimit ?? "no limit"} | ${usage._count.id} requests`
    );
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

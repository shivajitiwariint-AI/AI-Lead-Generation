import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/encryption";
import { getAuthContext } from "@/lib/auth-helpers";
import { recordAudit } from "@/lib/activity";
import { mockGenerate, estimateTokens } from "@/lib/ai/mock-engine";
import { isAIEnabled, isAITenantEnabled, isModelEnabledForTenant } from "@/lib/ai/settings";
import { randomUUID } from "crypto";

export type AIProviderKey =
  | "anthropic"
  | "google_gemini"
  | "xai_grok"
  | "ollama"
  | "openai"
  | "groq";

export type AIModuleKey =
  | "chatbot"
  | "lead_extraction"
  | "lead_qualification"
  | "company_research"
  | "complex_analysis"
  | "email_drafting"
  | "conversation_summary"
  | "embeddings";

export interface AIProviderConfig {
  id: string;
  providerKey: string;
  displayName: string;
  enabled: boolean;
}

export interface AIModelConfig {
  id: string;
  providerId: string;
  modelKey: string;
  displayName: string;
  capabilities: string[];
  enabled: boolean;
}

export interface AIModuleAssignment {
  moduleKey: AIModuleKey;
  modelId: string;
  fallbackModelId?: string;
}

export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tenantId?: string;
  moduleKey: AIModuleKey;
}

export interface GenerateTextResult {
  text: string;
  modelId: string;
  providerKey: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  requestId: string;
}

export interface AICredentialStore {
  providerId: string;
  encryptedSecret: string;
  keyVersion: number;
}

/**
 * Resolve the model to use for a given module and tenant.
 * Falls back to platform-level assignment, then to provider default.
 */
export async function resolveModelForModule(
  moduleKey: AIModuleKey,
  tenantId?: string
): Promise<{ model: AIModelConfig; provider: AIProviderConfig } | null> {
  // Tenant-specific assignment first, honouring per-tenant model overrides
  if (tenantId) {
    const assignment = await prisma.aIModuleAssignment.findFirst({
      where: { tenantId, moduleKey },
    });
    if (assignment) {
      const model = await prisma.aIModel.findUnique({
        where: { id: assignment.modelId },
      });
      if (!model) return null;
      const provider = await prisma.aIProvider.findUnique({
        where: { id: model.providerId },
      });
      if (!provider) return null;
      const tenantOk = await isModelEnabledForTenant(tenantId, model);
      if (tenantOk && model.enabled && provider.enabled) {
        return {
          model: {
            id: model.id,
            providerId: model.providerId,
            modelKey: model.modelKey,
            displayName: model.displayName,
            capabilities: (model.capabilities as string[]) ?? [],
            enabled: model.enabled,
          },
          provider: {
            id: provider.id,
            providerKey: provider.providerKey as string,
            displayName: provider.displayName,
            enabled: provider.enabled,
          },
        };
      }
    }
  }

  // Try platform-level assignment (tenantId = null or the "platform" sentinel)
  const platformAssignment = await prisma.aIModuleAssignment.findFirst({
    where: { OR: [{ tenantId: null }, { tenantId: "platform" }], moduleKey },
  });
  if (platformAssignment) {
    const model = await prisma.aIModel.findUnique({
      where: { id: platformAssignment.modelId },
    });
    if (!model) return null;
    const provider = await prisma.aIProvider.findUnique({
      where: { id: model.providerId },
    });
    if (!provider) return null;
    const tenantOk = await isModelEnabledForTenant(tenantId, model);
    if (tenantOk && model.enabled && provider.enabled) {
      return {
        model: {
          id: model.id,
          providerId: model.providerId,
          modelKey: model.modelKey,
          displayName: model.displayName,
          capabilities: (model.capabilities as string[]) ?? [],
          enabled: model.enabled,
        },
        provider: {
          id: provider.id,
          providerKey: provider.providerKey as string,
          displayName: provider.displayName,
          enabled: provider.enabled,
        },
      };
    }
  }

  return null;
}

/**
 * Get decrypted API key for a provider (tenant-specific or platform-level)
 */
export async function getProviderCredential(
  providerId: string,
  tenantId?: string
): Promise<string | null> {
  let credential = null;

  if (tenantId) {
    credential = await prisma.aICredential.findFirst({
      where: { providerId, tenantId },
    });
  }

  if (!credential) {
    credential = await prisma.aICredential.findFirst({
      where: { providerId, tenantId: null },
    });
  }

  if (!credential) return null;

  return decryptSecret(credential.encryptedSecret);
}

/**
 * Store (encrypt) a provider API key
 */
export async function storeProviderCredential(
  providerId: string,
  secret: string,
  tenantId?: string
) {
  const encrypted = encryptSecret(secret);

  // Upsert: update if exists, create if not
  const existing = await prisma.aICredential.findFirst({
    where: { providerId, tenantId: tenantId ?? null },
  });

  if (existing) {
    return prisma.aICredential.update({
      where: { id: existing.id },
      data: {
        encryptedSecret: encrypted,
        keyVersion: existing.keyVersion + 1,
        updatedAt: new Date(),
      },
    });
  }

  return prisma.aICredential.create({
    data: {
      tenantId: tenantId ?? null,
      providerId,
      encryptedSecret: encrypted,
      keyVersion: 1,
    },
  });
}

/**
 * Mask a stored credential for display
 */
export function getMaskedCredential(encryptedSecret: string): string {
  try {
    const decrypted = decryptSecret(encryptedSecret);
    return maskSecret(decrypted);
  } catch {
    return "****";
  }
}

/**
 * Record AI usage for cost tracking
 */
export async function recordAIUsage(params: {
  tenantId: string;
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  requestId?: string;
}) {
  await prisma.aIUsageLog.create({
    data: {
      tenantId: params.tenantId,
      providerId: params.providerId,
      modelId: params.modelId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      requestId: params.requestId ?? null,
    },
  });

  // Estimate cost (simple placeholder; real pricing varies by model)
  const estimatedCost =
    (params.inputTokens * 0.001 + params.outputTokens * 0.002) / 1000;

  await prisma.aICostLog.create({
    data: {
      tenantId: params.tenantId,
      providerId: params.providerId,
      modelId: params.modelId,
      estimatedCost,
    },
  });
}

/**
 * Check if tenant is within budget (requirement 10: Super Admin usage limits).
 * Reads the persisted AIBudget (tenant-specific first, then platform default);
 * falls back to a $100 monthly default when nothing is configured.
 */
export interface BudgetStatus {
  withinBudget: boolean;
  currentMonthCost: number;
  currentMonthTokens: number;
  budgetLimit: number;
  tokenLimit?: number;
  usageRatio: number;
  alertThreshold: number;
  enforce: boolean;
}

export async function checkBudget(tenantId: string): Promise<BudgetStatus> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [budget, costLogs, usageLogs] = await Promise.all([
    prisma.aIBudget.findFirst({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { tenantId: "desc" }, // tenant-specific row first (null sorts last in MySQL DESC)
    }),
    prisma.aICostLog.findMany({
      where: { tenantId, createdAt: { gte: startOfMonth } },
      select: { estimatedCost: true },
    }),
    prisma.aIUsageLog.findMany({
      where: { tenantId, createdAt: { gte: startOfMonth } },
      select: { inputTokens: true, outputTokens: true },
    }),
  ]);

  const currentMonthCost = costLogs.reduce(
    (sum, log) => sum + Number(log.estimatedCost),
    0
  );
  const currentMonthTokens = usageLogs.reduce(
    (sum, log) => sum + log.inputTokens + log.outputTokens,
    0
  );

  const budgetLimit = budget?.monthlyCostLimit != null ? Number(budget.monthlyCostLimit) : 100;
  const tokenLimit = budget?.monthlyTokenLimit ?? undefined;
  const alertThreshold = budget?.alertThreshold ?? 0.8;
  const enforce = budget?.enforce ?? false;

  const withinBudget =
    currentMonthCost < budgetLimit &&
    (tokenLimit == null || currentMonthTokens < tokenLimit);

  return {
    withinBudget,
    currentMonthCost,
    currentMonthTokens,
    budgetLimit,
    tokenLimit,
    usageRatio: budgetLimit > 0 ? currentMonthCost / budgetLimit : 0,
    alertThreshold,
    enforce,
  };
}

// ============================================
// Requirement 1: real text generation (provider calls + local fallback)
// ============================================

export interface ProviderTestResult {
  success: boolean;
  latency: number;
  error?: string;
  model?: string;
}

/**
 * Make a minimal real call to a provider to verify the credential + models work.
 * Tries each provider's enabled models in order and returns the first success.
 */
export async function testProviderConnection(
  providerId: string,
  tenantId?: string
): Promise<ProviderTestResult> {
  const provider = await prisma.aIProvider.findUnique({ where: { id: providerId } });
  if (!provider) {
    return { success: false, latency: 0, error: "Provider not found" };
  }

  const cred = (await getProviderCredential(providerId, tenantId)) ?? envCredentialFor(provider.providerKey);
  if (!cred) {
    return { success: false, latency: 0, error: "No API key configured" };
  }

  const enabled = await prisma.aIModel.findMany({
    where: { providerId, enabled: true },
    orderBy: { displayName: "asc" },
    take: 6,
  });
  if (enabled.length === 0) {
    return { success: false, latency: 0, error: "No models found for this provider" };
  }

  // For Ollama: prefer models actually installed locally (/api/tags), smallest first (loads fastest)
  let ordered = enabled;
  if (provider.providerKey === "ollama") {
    try {
      const base = cred.replace(/\/$/, "");
      const tagsRes = await fetch(`${base}/api/tags`, {
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      const tags = await tagsRes.json().catch(() => null);
      const installed: { name: string; size: number }[] = (tags?.models ?? []).map((m: any) => ({ name: m.name, size: m.size ?? Infinity }));
      const sizeOf = (name: string) => installed.find((i) => i.name === name)?.size ?? Infinity;
      const installedNames = installed.map((i) => i.name);
      const matched = enabled
        .filter((m) => installedNames.includes(m.modelKey))
        .sort((a, b) => sizeOf(a.modelKey) - sizeOf(b.modelKey));
      if (matched.length > 0) {
        ordered = matched;
      } else if (installed.length > 0) {
        // Use the smallest installed model that isn't seeded in DB yet
        const smallest = [...installed].sort((a, b) => a.size - b.size)[0];
        ordered = [{ id: "installed", providerId, modelKey: smallest.name, displayName: smallest.name } as any];
      }
    } catch {
      /* keep enabled list; errors surface below */
    }
  }

  const start = Date.now();
  const errors: string[] = [];
  for (const model of ordered) {
    try {
      const out = await callProvider(provider.providerKey, {
        apiKey: cred,
        modelKey: model.modelKey,
        prompt: "Reply with exactly: OK",
        temperature: 0,
        maxTokens: 1000, // reasoning models need headroom
      });
      if (out.text.trim()) {
        return { success: true, latency: Date.now() - start, model: model.modelKey };
      }
      errors.push(`${model.modelKey}: empty response`);
    } catch (err: any) {
      errors.push(`${model.modelKey}: ${String(err?.message ?? err).slice(0, 160)}`);
    }
  }
  return {
    success: false,
    latency: Date.now() - start,
    error: errors.join(" | ").slice(0, 450),
  };
}

export interface ModelTestResult {
  success: boolean;
  latency: number;
  error?: string;
  modelKey?: string;
  providerKey?: string;
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Test one specific model (not just the provider) with a minimal real request.
 * Used by the admin "Test AI setup" check.
 */
export async function testModelConnection(
  modelId: string,
  tenantId?: string
): Promise<ModelTestResult> {
  if (!(await isAIEnabled())) {
    return {
      success: false,
      latency: 0,
      error: "AI is globally disabled by admin — enable it from AI Models to test",
    };
  }
  const model = await prisma.aIModel.findUnique({ where: { id: modelId } });
  if (!model) return { success: false, latency: 0, error: "Model not found" };

  const provider = await prisma.aIProvider.findUnique({
    where: { id: model.providerId },
  });
  if (!provider) return { success: false, latency: 0, error: "Provider not found" };
  if (!model.enabled || !provider.enabled) {
    return {
      success: false,
      latency: 0,
      error: `${provider.displayName} / ${model.displayName} is disabled`,
    };
  }

  const cred =
    (await getProviderCredential(provider.id, tenantId)) ??
    envCredentialFor(provider.providerKey);
  if (!cred) {
    return {
      success: false,
      latency: 0,
      error: `No API key configured for ${provider.displayName}`,
    };
  }

  const start = Date.now();
  try {
    const out = await callProvider(provider.providerKey, {
      apiKey: cred,
      modelKey: model.modelKey,
      prompt: "Reply with exactly: OK",
      temperature: 0,
      maxTokens: 512, // reasoning models need headroom
    });
    if (!out.text.trim()) {
      return {
        success: false,
        latency: Date.now() - start,
        error: `${model.displayName} returned an empty response`,
        modelKey: model.modelKey,
        providerKey: provider.providerKey,
      };
    }
    return {
      success: true,
      latency: Date.now() - start,
      modelKey: model.modelKey,
      providerKey: provider.providerKey,
      text: out.text.trim().slice(0, 120),
      inputTokens: out.inputTokens,
      outputTokens: out.outputTokens,
    };
  } catch (err: any) {
    return {
      success: false,
      latency: Date.now() - start,
      error: String(err?.message ?? err).slice(0, 300),
      modelKey: model.modelKey,
      providerKey: provider.providerKey,
    };
  }
}

export class AIBudgetExceededError extends Error {
  constructor(
    public usage: number,
    public limit: number
  ) {
    super(`AI budget exceeded: $${usage.toFixed(4)} of $${limit} used this month`);
    this.name = "AIBudgetExceededError";
  }
}

const ENV_KEY_BY_PROVIDER: Partial<Record<AIProviderKey, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google_gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai_grok: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
};

function envCredentialFor(providerKey: string): string | null {
  if (providerKey === "ollama") {
    return process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  }
  const envName = ENV_KEY_BY_PROVIDER[providerKey as AIProviderKey];
  const value = envName ? process.env[envName] : undefined;
  return value && value.trim() ? value.trim() : null;
}

interface ProviderCallInput {
  apiKey: string;
  modelKey: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
}

interface ProviderCallOutput {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function callProvider(
  providerKey: string,
  input: ProviderCallInput
): Promise<ProviderCallOutput> {
  const { signal, done } = withTimeout(30_000);
  try {
    switch (providerKey) {
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal,
          headers: {
            "x-api-key": input.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: input.modelKey,
            max_tokens: input.maxTokens,
            temperature: input.temperature,
            ...(input.systemPrompt ? { system: input.systemPrompt } : {}),
            messages: [{ role: "user", content: input.prompt }],
          }),
        });
        if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        return {
          text: (data.content ?? []).map((c: any) => c.text ?? "").join("\n"),
          inputTokens: data.usage?.input_tokens ?? estimateTokens(input.prompt),
          outputTokens: data.usage?.output_tokens ?? 0,
        };
      }

      case "openai":
      case "xai_grok": {
        const base = providerKey === "xai_grok" ? "https://api.x.ai/v1" : "https://api.openai.com/v1";
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          signal,
          headers: {
            authorization: `Bearer ${input.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: input.modelKey,
            temperature: input.temperature,
            max_tokens: input.maxTokens,
            messages: [
              ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
              { role: "user", content: input.prompt },
            ],
          }),
        });
        if (!res.ok) throw new Error(`${providerKey} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        return {
          text: data.choices?.[0]?.message?.content ?? "",
          inputTokens: data.usage?.prompt_tokens ?? estimateTokens(input.prompt),
          outputTokens: data.usage?.completion_tokens ?? 0,
        };
      }

      case "groq": {
        const base = "https://api.groq.com/openai/v1";
        const res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          signal,
          headers: {
            authorization: `Bearer ${input.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: input.modelKey,
            temperature: input.temperature,
            max_tokens: input.maxTokens,
            messages: [
              ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
              { role: "user", content: input.prompt },
            ],
          }),
        });
        if (!res.ok) throw new Error(`groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        return {
          text: data.choices?.[0]?.message?.content ?? "",
          inputTokens: data.usage?.prompt_tokens ?? estimateTokens(input.prompt),
          outputTokens: data.usage?.completion_tokens ?? 0,
        };
      }

      case "google_gemini": {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          input.modelKey
        )}:generateContent?key=${encodeURIComponent(input.apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: input.prompt }] }],
            ...(input.systemPrompt
              ? { systemInstruction: { parts: [{ text: input.systemPrompt }] } }
              : {}),
            generationConfig: { temperature: input.temperature, maxOutputTokens: input.maxTokens },
          }),
        });
        if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        return {
          text: parts.map((p: any) => p.text ?? "").join("\n"),
          inputTokens: data.usageMetadata?.promptTokenCount ?? estimateTokens(input.prompt),
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        };
      }

      case "ollama": {
        const base = input.apiKey.replace(/\/$/, "");
        const res = await fetch(`${base}/api/chat`, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: input.modelKey,
            stream: false,
            messages: [
              ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : []),
              { role: "user", content: input.prompt },
            ],
          }),
        });
        if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        return {
          text: data.message?.content ?? "",
          inputTokens: data.prompt_eval_count ?? estimateTokens(input.prompt),
          outputTokens: data.eval_count ?? 0,
        };
      }

      default:
        throw new Error(`unsupported provider: ${providerKey}`);
    }
  } finally {
    done();
  }
}

export interface GenerateTextOutput extends GenerateTextResult {
  mock: boolean;
  fallbackReason?: "no_model_assignment" | "no_api_key" | "provider_error" | "globally_disabled";
}

/**
 * Generate text for a module. Resolves the tenant's model assignment, calls
 * the real provider when a credential exists (DB credential or env key), and
 * falls back to the deterministic local engine otherwise so every feature
 * works end-to-end without keys. Records usage + an `ai.generate` audit event.
 */
export async function generateText(
  input: GenerateTextInput
): Promise<GenerateTextOutput> {
  const {
    moduleKey,
    prompt,
    systemPrompt,
    temperature = 0.4,
    maxTokens = 1500,
    tenantId,
  } = input;
  const requestId = randomUUID();

  // Global kill-switch: never call a paid provider while disabled (local mock only).
  if (!(await isAIEnabled()) || !(await isAITenantEnabled(tenantId))) {
    const text = mockGenerate(moduleKey, prompt, systemPrompt);
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(text);
    if (tenantId) {
      await recordAudit({
        tenantId,
        actorType: "system",
        action: "ai.global_disabled",
        category: "ai",
        metadata: { moduleKey, requestId, promptPreview: prompt.slice(0, 160) },
      }).catch(() => {});
    }
    return {
      text,
      modelId: "global-disabled",
      providerKey: "local",
      inputTokens,
      outputTokens,
      estimatedCost: 0,
      requestId,
      mock: true,
      fallbackReason: "globally_disabled" as const,
    };
  }

  // Requirement 10: enforce persisted usage limits before spending
  if (tenantId) {
    const budget = await checkBudget(tenantId);
    if (budget.enforce && !budget.withinBudget) {
      await recordAudit({
        tenantId,
        actorType: "system",
        action: "ai.budget_exceeded",
        category: "ai",
        metadata: {
          moduleKey,
          monthCost: budget.currentMonthCost,
          monthTokens: budget.currentMonthTokens,
          budgetLimit: budget.budgetLimit,
          tokenLimit: budget.tokenLimit ?? null,
        },
      });
      throw new AIBudgetExceededError(budget.currentMonthCost, budget.budgetLimit);
    }
  }

  const resolved = await resolveModelForModule(moduleKey, tenantId);
  const providerKey = resolved?.provider.providerKey ?? null;
  const modelKey = resolved?.model.modelKey ?? null;

  let apiKey = resolved ? await getProviderCredential(resolved.provider.id, tenantId) : null;
  if (!apiKey && providerKey) apiKey = envCredentialFor(providerKey);

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let mock = false;
  let fallbackReason: GenerateTextOutput["fallbackReason"];

  if (resolved && providerKey && modelKey && apiKey) {
    try {
      const out = await callProvider(providerKey, {
        apiKey,
        modelKey,
        prompt,
        systemPrompt,
        temperature,
        maxTokens,
      });
      text = out.text;
      inputTokens = out.inputTokens;
      outputTokens = out.outputTokens || estimateTokens(text);
      if (!text.trim()) throw new Error("empty model response");
    } catch (err) {
      mock = true;
      fallbackReason = "provider_error";
      text = mockGenerate(moduleKey, prompt, systemPrompt);
      inputTokens = estimateTokens(prompt);
      outputTokens = estimateTokens(text);
      console.warn(
        `[ai-gateway] provider call failed (${(err as Error).message}), using local engine`
      );
    }
  } else {
    mock = true;
    fallbackReason = resolved ? "no_api_key" : "no_model_assignment";
    text = mockGenerate(moduleKey, prompt, systemPrompt);
    inputTokens = estimateTokens(prompt);
    outputTokens = estimateTokens(text);
  }

  const estimatedCost = (inputTokens * 0.001 + outputTokens * 0.002) / 1000;

  // Usage/cost logging (only when real provider/model rows were resolved)
  if (tenantId && resolved) {
    await recordAIUsage({
      tenantId,
      providerId: resolved.provider.id,
      modelId: resolved.model.id,
      inputTokens,
      outputTokens,
      requestId,
    }).catch((err) => console.error("[ai-gateway] usage log failed:", err));
  }

  // Requirement 7: every AI action is visible in the live activity feed
  if (tenantId) {
    await recordAudit({
      tenantId,
      actorType: "ai",
      action: "ai.generate",
      category: "ai",
      targetType: "module",
      targetId: null,
      metadata: {
        moduleKey,
        provider: providerKey ?? "local",
        model: modelKey ?? "local-engine",
        mock,
        fallbackReason: fallbackReason ?? null,
        inputTokens,
        outputTokens,
        requestId,
        promptPreview: prompt.slice(0, 160),
      },
    });
  }

  return {
    text,
    modelId: resolved?.model.id ?? "local-engine",
    providerKey: providerKey ?? "local",
    inputTokens,
    outputTokens,
    estimatedCost,
    requestId,
    mock,
    fallbackReason,
  };
}

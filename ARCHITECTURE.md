# Architecture — AI Lead Generation & Sales Automation SaaS

> **Purpose:** This document describes everything users see and everything under the hood — features, flows, data, AI, security, and operations.
> **Audience:** Product, engineering, and reviewers who need a single source of truth.
> **Last verified:** live on `localhost:3000` (Next 14.2.14), MySQL `ai_lead_gen`, all pages `200`, all admin APIs `200` for super-admin / `403` for company users.

---

## 1. What this product is

A **multi-tenant AI sales automation** platform. Think of it as an AI sales team that works inside each company’s private workspace:

- **Captures** leads (research, manual entry, CSV import, website chatbot, webhook ingest).
- **Qualifies** them (AI scoring + offer matching).
- **Engages** them (drafts personalized outreach, proposes meetings, schedules follow-ups).
- **Tracks** everything (pipeline, conversations, emails, audit logs).
- **Controls itself** (automation modes, pause switch, per-lead takeover, global AI kill-switch, per-company AI/model toggles, token budgets).

Public visitors get a **RAG assistant** on the homepage and an **embeddable widget** on any website; authenticated staff get the full workspace.

### Personas

| Persona | Access | What they do |
|---|---|---|
| Public visitor (no login) | Homepage + `/api/v1/public/*` only | Ask about services, features, pricing, demo |
| Company Owner (`COMPANY_OWNER`) | Full access to their tenant | Onboarding, Research, Secrets (SMTP), AI packs, Leads, Emails |
| Sales Manager (`SALES_MANAGER`) | `leads:*`, `messages:*`, `reports:read`… | Approve emails, manage pipeline |
| Sales Rep (`SALES_REPRESENTATIVE`) | `leads:read/write`, `messages:read/send` | Work leads, reply in conversations |
| Read-only Analyst (`READ_ONLY_ANALYST`) | `leads:read`, `reports:read` | View reports/dashboard |
| Super Admin (`SUPER_ADMIN`) | Platform tenant (`slug: platform`) | Companies, AI Providers/Models/Assignments/Usage, Public Docs, Roles, Smtp per company, Audit Logs |

---

## 2. Tech stack

| Layer | Choice | Why / Notes |
|---|---|---|
| Language / runtime | TypeScript, Node 24 | Single language end-to-end |
| Framework | Next.js 14.2.14 (App Router) | RSC + client pages, `route.ts` APIs, middleware |
| UI | React 18, Tailwind, Radix (Dialog/Select/Switch/Tabs/Tooltip), Lucide, Sonner, Recharts | Dark theme, toasts, accessible primitives |
| Auth | NextAuth 4 (JWT sessions, Credentials + OAuth) | HttpOnly `SameSite=Lax` cookies; `AUTH_SECRET` JWT secret |
| ORM / DB | Prisma 5.22 + MySQL (`ai_lead_gen` on `localhost:3306`) | `prisma db push` (no migration files), indexes on `tenantId`, statuses |
| AI | Custom `lib/ai-gateway.ts` over providers (Anthropic, Google Gemini, Groq, Ollama, OpenAI, xAI Grok) | Primary `openai/gpt-oss-120b` (Groq) + fallback `qwen3:8b` (Ollama); deterministic `mock-engine` fallback |
| Mail | `nodemailer` (per-company SMTP) → Resend (`RESEND_API_KEY`) → simulated | Per-tenant `SmtpConfig` with encrypted passwords |
| Crypto | AES-256-GCM (`lib/encryption.ts`, `CREDENTIAL_ENCRYPTION_KEY` ≥32 chars) | Encrypted provider + SMTP secrets |
| Validation | Zod | All mutating APIs validate shape |
| Rate limiting | In-memory `lib/rate-limit.ts` + middleware IP cap | AI/financial endpoints + global API 120/min |
| Cron | Vercel Cron `POST /api/cron/dispatch-due-jobs` (`CRON_SECRET`) | `*/5 * * * *` (every 5 min) — **production only; localhost is manual** |
| Tooling | `vitest`, `playwright`, `postcss`, `tailwind`, `eslint-config-next` | `npm test`, `npm run test:e2e`, `npm run type-check` |

Env (names only, never values): `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`, `CREDENTIAL_ENCRYPTION_KEY`, `CRON_SECRET`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `HUGGINGFACE_API_KEY`, `SERPER_API_KEY`, `XAI_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `RESEND_API_KEY`, `WHATSAPP_*`, `OBJECT_STORAGE_*`, `SENTRY_DSN`, plus `INGEST_API_KEY` for server-to-server ingest.

---

## 3. Repository structure (what matters)

```
app/
  page.tsx                 # Public landing + <PublicChat/> (RAG)
  layout.tsx               # Theme + Toaster
  (app)/                   # Authenticated workspace (ShellLayout)
    layout.tsx             # getAuthContext → AppShell (Sidebar+Header+AiBackground)
    dashboard/page.tsx     # role-split: Super Admin Platform Overview vs Client lead dashboard
    leads/page.tsx         # list + Ask AI + Add/Import + bulk delete/takeover (checkboxes)
    leads/[id]/page.tsx    # detail: info, synthetic warning, last email, timeline, qualification
    leads/[id]/edit/page.tsx
    leads/[id]/message/page.tsx   # mini rich-text editor (Bold/Italic/Underline/Link) + attachments
    leads/[id]/followup/page.tsx
    pipeline/ conversations/ chatbots/ chatbots/[id]/ knowledge-base/
    follow-ups/ meetings/ emails/ campaigns/ reports/ team/ settings/ ...
    research/ company/ activity/ profile/ audit-logs/ jobs/
    ai-providers/ ai-models/ ai-assignments/ ai-usage/
    admin/companies/ admin/companies/[id]/ admin/public-docs/ admin/roles/
components/
  app-shell.tsx sidebar.tsx header.tsx (bell + badges) onboarding-guard.tsx
  public-chat.tsx          # Homepage floating RAG chat (no login)
  ai-switch-card.tsx       # Global AI on/off (AI Assignments + AI Models)
  company-ai-models-card.tsx # Per-company AI + per-model switches
  search-schedule-card.tsx # Per-country search frequency
  real-estate-card.tsx software-outreach-card.tsx # Outreach packs
  smtp-card.tsx            # Per-company SMTP (Admin)
  delete-lead-button.tsx lead-takeover-toggle.tsx
  ui/                      # Button, Card, Badge, Switch, Select, Tabs…
lib/
  auth.ts auth-helpers.ts    # NextAuth options, bcrypt, rate limit, audit on login
  prisma.ts                  # singleton client
  activity.ts                # recordAudit() / recordLeadActivity() (never-throw)
  encryption.ts              # AES-256-GCM encrypt/decrypt/mask
  rate-limit.ts              # checkRateLimit(key, limit, windowMs) + login helpers
  ai-gateway.ts              # resolveModelForModule, testModelConnection, generateText
  ai/ settings.ts orchestrator.ts research.ts qualification.ts matching.ts email.ts mock-engine.ts
  ai/ real-estate.ts software-outreach.ts search-schedule.ts
  jobs/worker.ts             # drainJobs(), enqueueJob(), handleJob()
  rag.ts                     # tenant RAG: KnowledgeChunk + PublicDoc retrieval
  public-knowledge.ts  public-guardrails.ts  smtp.ts
app/api/v1/
  activity/ agent/run+takeover/ ai settings/ admin/ai/* budgets usage test models providers assignments
  admin/companies/[id]/ ai-models smtp/ reset-password/   admin/public-docs/ admin/roles/
  leads + [id] (GET/PATCH/DELETE) + qualify/control/followups/activities/assign + import + ingest
  emails + [id] (GET/PATCH) + approve/reject/send   messages/   meetings/ followups/
  conversations + [id]/messages   chatbots + [id]   research/sources+runs
  knowledge/*  campaigns/*  public/chat + public/chat/[publicKey](+widget.js)
  cron/dispatch-due-jobs/   company-profile/  workspaces/ … /auth/*
middleware.ts                # withAuth + sec headers + API IP limiter
next.config.js               # reactStrictMode, bodySizeLimit 2mb, security headers()
prisma/schema.prisma (+ seed.ts)
scripts/set-default-ai-assignments.js  (Groq primary + Ollama fallback, budget seed)
```

---

## 4. System architecture (request path)

```
Browser (localhost:3000 / Vercel)
  │
  ├─ Public:  GET / (landing + RAG chat), POST /api/v1/public/chat, POST /api/v1/public/chat/[key]
  │             (no session; AI guardrails + per-IP limit)
  │
  └─ Private:  /dashboard, /leads, …  →  middleware (withAuth)
        ├─ Page: RSC / client fetch — session JWT cookie (HttpOnly)
        ├─ ShellLayout: getAuthContext() → redirect to /auth/signin if anon
        │                → OnboardingGuard → AppShell (Sidebar/Header)
        └─ APIs: session JWT (tenantId pinned) + RBAC permission check
                 (except public allowlist) + rate limiter
                       │
                 Prisma → MySQL (tenant-isolated rows)
                       │
              AI gateway: resolve model → global/tenant/per-model kill-switch
                       → checkBudget → call provider (or local mock) → log usage+audit
                       │
              Cron (prod): POST /api/cron/dispatch-due-jobs (Bearer CRON_SECRET)
                       → claim due follow-ups → runWorkflow per tenant → drainJobs
```

**Security headers** (`next.config.js headers()` on `/:path*`, also applied in middleware):
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`, `X-XSS-Protection: 1; mode=block`, `X-Powered-By` stripped. HSTS is middleware-only on HTTPS.

---

## 5. Data model (Prisma, `ai_lead_gen`)

**Platform & identity**
| Model | Purpose |
|---|---|
| `Tenant` | Company workspace. `slug` unique (`platform` = super-admin). `operatingMode` (`FULLY_AI_AUTOMATED / AI_WITH_APPROVAL / FULLY_MANUAL`), `automationPaused` (takeover), `aiEnabled` (per-company kill-switch), `enabledModules` (module allowlist), `status/timezone/planId` |
| `User` | Login identity (email unique, bcrypt `password`, `status` PENDING_VERIFICATION/ACTIVE/SUSPENDED…) |
| `TenantUser` | Membership (`@@unique[tenantId,userId]`), maps user → role |
| `Role` (`SUPER_ADMIN/COMPANY_OWNER/SALES_MANAGER/SALES_REPRESENTATIVE/READ_ONLY_ANALYST`, `@@unique[tenantId,type]`) + `Permission` (`key` unique) + `RolePermission` (`@@unique[roleId,permissionId]`) | RBAC. Seed wires `leads:*`, `messages:*`, `campaigns:*`, `reports:read`, `integrations:read`, `ai:*`, `audit:read`, `settings:write` etc. Super Admin + Company Owner = all perms; matrix managed at **Admin → Roles** |
| `Account/Session/VerificationToken` | NextAuth Prisma adapter tables |

**CRM core**
| Model | Purpose |
|---|---|
| `Lead` | Single source of truth: `tenantId, name, email, phone, company, website, industry, location, requirement(Text), status, score, aiSummary, controlMode(ai/manual), lastContactedAt, lastAiActionAt, consentMarketing` |
| `LeadSource` | Attribution: `sourceType (research/manual/csv/website…)`, `externalId`, `attribution(JSON: runId, platform, mock…)` |
| `LeadActivity` | Per-lead timeline (`lead_created`, `email_*, `status_changed`, `manual_takeover`, …) |
| `LeadQualificationResult` | Latest AI score: `fit/intent/urgency/completeness`, `summary, nextAction, confidence, evidence(JSON)`, `matchScore, matchedOffers(JSON)`, `modelId, tokenUsage, estimatedCost, processingStatus` |
| `LeadRequirementValue` + `Industry/Template/FieldDefinition` | Requirement key-values + industry templates |
| `Campaign / CampaignLead` | Outreach campaigns + lead membership |
| `Conversation` (`status open/handoff_requested`, `chatbotId/leadId`) + `ChatMessage` (`role user/assistant/system, content, metadata`) | In-app chat (RAG) + embed widget chats |
| `Chatbot` (`publicKey` unique, `settings JSON {welcomeMessage, leadCaptureEnabled, useKnowledgeBase, usePublicDocs}`, `status`) | Embeddable website bot |
| `KnowledgeDocument` + `KnowledgeChunk` (`chunkIndex, content, embeddingRef`) | Tenant RAG corpus (keyword-scored retrieval) |
| `MessageTemplate` | Reusable email templates |

**AI & messaging ops**
| Model | Purpose |
|---|---|
| `AIProvider` (`providerKey` unique) + `AIModel` (`providerId, modelKey, capabilities[], enabled`) + `AICredential` (`tenantId, encryptedSecret, keyVersion`) | Model catalog; keys encrypted, never returned |
| `AIModuleAssignment` (`tenantId+moduleKey` unique) | Which model (+ fallback) per module (`chatbot, lead_extraction/qualification, company_research, complex_analysis, email_drafting, conversation_summary, embeddings`) per tenant or platform |
| `AIUsageLog` + `AICostLog` | Token/cost per request (cost = placeholder formula) |
| `AIBudget` (`tenantId` unique, null = platform) | Monthly token + cost caps, `alertThreshold`, `enforce` — checked in `generateText()` |
| `AISettings` (singleton `id="global"`) | Global kill-switch `aiEnabled` |
| `AITenantModel` (`@@unique[tenantId,modelId]`) | Per-company per-model enable/disable overrides |
| `PublicDoc` (`title, keywords[], content, enabled`) | Admin-managed public RAG docs (seeded from `lib/public-knowledge.ts`) |
| `Message` (`channel email/whatsapp, status draft/pending_review/approved/rejected/sent, subject/body/to/from, generatedBy, meta JSON {website, attachments, mock, …}, sentAt`) | Email lifecycle |
| `ApprovalItem` (`itemType email/…, status pending/approved/rejected`) | Human approval queue (mirrors `pending_review`) |
| `FollowupTask` (`dueAt, status pending/running/completed/canceled, idempotencyKey` unique) | Scheduled follow-ups |
| `ConsentRecord` + `SuppressionEntry` (`contactHash, channel`) | Consent + do-not-contact enforcement |
| `Meeting` (`title, startsAt/endsAt, status proposed/scheduled/completed/canceled, createdBy ai/manual`) | Discovery calls (AI-proposed or manual) |
| `AutomationJob` (`jobType, status pending/running/completed/failed, attempts/maxAttempts, runAt, payload`) + `OutboxEvent/WebhookEvent` | Background queue (claim + backoff + drain) |

**Platform/audit**
| Model | Purpose |
|---|---|
| `Tenant` company profile: `CompanyProfile` (`tenantId` unique, `industry, website, description, products/services/properties[], salesObjectives[], targetMarket JSON`) | Onboarding + AI packs + schedules |
| `targetMarket` JSON (no new table needed): `{ locations[], segments[], searchFrequencies{country:{enabled,everyHours}}, realEstate{…}, software{…} }` | Per-country search frequency + RE/SW pack configs |
| `AgentRun` (`tenantId, trigger manual/cron/event, mode, status running/completed/failed/paused, leadId, steps JSON, summary, startedAt/finishedAt`) | Workflow run trail (req 7) |
| `AuditLog` (`tenantId?, actorId?, actorType user/ai/system, action, category, targetType/Id, metadata JSON, createdAt`) | **Security + audit trail** (req 11); backs Activity + Audit Logs |
| `ScoringProfile` | Score weights per workspace |
| `FileAsset`, `Integration`, `Plan/Subscription`, `ResearchSource/ResearchRun` | Files, external integrations, billing, research provenance |
| `SmtpConfig` (`tenantId` unique, `host/port/secure, username, passwordEncrypted, fromEmail/fromName, enabled`) | Per-company mailbox (admin-managed) |

> MySQL FKs are intentionally plain-indexed (`@@index`) — cascades are done **in code** (e.g. lead delete deletes messages/activities/qualifications/follow-ups/meetings then detaches conversations). No `ON DELETE CASCADE` at DB level.

---

## 6. Feature map (what users see)

### Public
- **Landing `/`**: hero, live preview card, stats, features (scoring/chatbot/pipeline/follow-ups/teams/audit), How-it-works (Capture→Qualify→Engage). Floating **RAG chat** (`<PublicChat/>`) — public-doc retrieval + Groq, citations, guardrails, `30 req/10 min/IP`.

### Workspace (authenticated)
- **Dashboard `/dashboard`**: super-admin → Platform Overview (companies, users, leads, AI spend, providers/models health). Company → lead dashboard (pipeline, recent leads).
- **Leads `/leads`**: list + status/source filters + search, Ask AI (single/all), Add, CSV import, bulk checkbox → **Delete selected / Takeover selected / Resume AI**; rows → detail `/leads/[id]` (info, synthetic warning, last email with website/attachments, timeline, AI Qualification + Matched Offers, Takeover toggle) → Edit → Draft Message (mini editor, attachments, Approve→Send) → Schedule Follow-up.
- **Pipeline `/pipeline`**: Kanban by status (AIBudget not involved).
- **Conversations `/conversations`**: RAG chat (Knowledge Base + Public Docs), New chat, message send, **Handoff** (manual takeover), RAG sources in metadata.
- **Chatbots `/chatbots`**: CRUD (RAG enabled, welcome/lead-capture toggles), per-bot embed `<script src="…/public/chat/{key}/widget.js">` (working floating widget, tenant-scoped RAG), Configure `/chatbots/[id]` (RAG settings + Live test).
- **Knowledge Base `/knowledge-base`**: tenant docs + chunks (RAG corpus).
- **Follow-ups `/follow-ups`**: real list + stats (Due Today/Overdue/Pending/Completed), complete/cancel/reopen. Auto-completed by workflow; due tasks claimed by cron.
- **Meetings `/meetings`**: AI-proposed + manual discovery calls; Confirm → lead → `meeting_scheduled`, Complete/Cancel with audit.
- **Emails `/emails`**: Generate with AI (lead + purpose), list + review/edit (rich text), Approve/Reject/Send with approval gate.
- **Campaigns, Reports, Scoring Profiles, Team (read-only list + Invite), Integrations, Settings** (general/security/notifications).
- **Research `/research`**: Approved Sources (add/approve) + Discover (industry/location/size/maxResults/source) + run history. Embeds **per-country frequency**, **Real Estate** and **Software** pack editors (industry-gated).
- **Company `/company`**: onboarding/profile (industry, website, products/services).
- **Activity `/activity`**: live feed (4s poll) + Agent Runs + Audit Log (user/ai/system filter), Operating Mode, Manual Takeover, Run workflow.
- **Audit Logs `/audit-logs`**: category/actor filters, full metadata.
- **Profile / Logout** in header.

### Super-admin
- **Companies `/admin/companies`**: list + stats; **detail `/admin/companies/[id]`**: status/mode/pause, module access, members + password reset, **AI models for this company** (master + per-model switches + Enable/Disable all), **SMTP** (host/port/SSL/user/pass/from, Test), search schedules, RE/SW packs, Danger zone (delete company).
- **AI Providers `/ai-providers`**: keys (encrypted, masked), enable/disable per provider, Test connection, Delete; floating RAG chat cloned here.
- **AI Models `/ai-models`**: global kill-switch card + Enable/Disable all + per-model Switch + Test (real minimal request).
- **AI Assignments `/ai-assignments`**: module→model + fallback, super-admin scope selector (Platform vs IBM), **Use Groq + Ollama defaults**, **Test AI setup / Test untested (N) / Re-test all** (only clicked button shows spinner; re-runs skipped to save tokens), token-availability card (budget tokens/cost).
- **AI Usage `/ai-usage`**: requests/tokens/cost stats + **Usage limits** editor (Scope → tokens/cost/alert/enforce) → `AIBudget`.
- **Public Docs `/admin/public-docs`**: CRUD approved public RAG docs (live, no deploy).
- **Roles `/admin/roles`**: permission matrix per role (Super Admin/Owner locked full).
- **Settings / Audit Logs**: platform config + security trail.

---

## 7. Core flows

### 7.1 Lead generation (Ask AI / cron)

```
POST /api/v1/agent/run (manual)  ─┐
POST /api/cron/dispatch-due-jobs ─┴─► runWorkflow({trigger, tenantId, leadId?, maxLeads})
  ├─ AI global/per-tenant OFF? → paused "AI disabled by admin" (0 metrics, 0 tokens)
  ├─ automationPaused / FULLY_MANUAL? → paused
  ├─ Discover (per-country schedules):
  │    manual → create ResearchRun per enabled country (forced)
  │    cron   → create only if last run > everyHours (getSchedules)
  │    fields: figure industry/location/size + RE/SW fragments + profile description
  ├─ Research: executeResearchRun (per pending run, max 5) → create Leads (de-dupe by email/phone)
  │    requirement = reason + propertyInterest + budget + LinkedIn + websiteAnalysis
  │    LeadSource { sourcePlatform, mock: false (Groq) }
  ├─ Qualify: qualifyAndMatchLead per new/unreviewed (controlMode=ai):
  │    prompt = Lead + RE/SW fragments + offers (catalog or RE/SW fallback)
  │    → fit/intent/urgency/completeness + matchScore/matchedOffers → score, status, aiSummary
  ├─ Outreach: qualified + lastContactedAt=null + not suppressed:
  │    generateOutreachEmail (prompt + website + attachments) → ALWAYS pending_review
  │    → never auto-sent (approval gate); orchestrator counts pending++
  ├─ Meetings: score ≥60 → Meeting(proposed) + meeting_proposed activity
  ├─ Follow-ups: due pending (controlMode=ai) → completed + activity
  └─ persist AgentRun(steps, summary, metrics) + workflow.completed audit + metrics {leadsCreated/Qualified, emailsDrafted/PendingApproval, meetingsProposed…}
```

> **Email approval gate (new):** `generateOutreachEmail()` starts `pending_review` for all modes, creates `ApprovalItem`. `POST …/send` requires `status == approved`. UI: Draft message → **Approve** → **Send now** enables only after approval.

### 7.2 Email lifecycle

```
Generate (AI / manual) → pending_review → Approve → approved → Send → sent
                                            ↕ Edit (→ draft, re-approve)  Reject → rejected → Recreate
```

- Attachments: name+URL list in Draft Message → included in prompt + appended as `Attachments: …` in body → `meta.attachments`.
- Website: `CompanyProfile.website` appended as `Have a look at our work: {website} / Please review the link…` if model omitted it.
- Styled body: mini markdown (`**bold**`, `*italic*`, `__underline__`, links) rendered as HTML preview; send uses plain text.
- Sending priority: `SmtpConfig(enabled)` (Nodemailer) → `RESEND_API_KEY` → **simulated** (`meta.simulated: true, provider: local`). No delivery without `RESEND_API_KEY`.

### 7.3 Conversations / Chatbots (RAG)

- **Internal (authenticated):** `POST /conversations` (New) → `POST …/messages` (user msg → retrieve Tenant RAG: KnowledgeChunks keyword-ranked + PublicDocs → `generateText(chatbot)` → assistant msg + `metadata.ragSources`; `handoff` action → `handoff_requested`, AI replies stop).
- **Public (homepage + embed):** `POST /api/v1/public/chat` → retrieve PublicDocs only → guardrails → Groq (or KB fallback). Bot embed: `POST /public/chat/{publicKey}` → tenant RAG + bot settings; `GET …/widget.js` → zero-dep floating bubble.

### 7.4 Takeover (manual control)

| Level | Switch | Effect |
|---|---|---|
| Global | `Tenant.automationPaused` / `operatingMode FULLY_MANUAL` | Workflow + cron pause (`paused`) |
| Per company | `Tenant.aiEnabled` (master) + `AITenantModel` overrides | `generateText()` → local mock, zero tokens; workflow pauses if tenant OFF |
| Per lead | `Lead.controlMode = manual/ai` | Orchestrator skips non-`ai` leads; detail toggle |
| Per conversation | `status = handoff_requested` | No more AI replies in that chat |

### 7.5 Cron & jobs

- **Vercel Cron**: `*/5 * * * * → POST /api/cron/dispatch-due-jobs` (Bearer `CRON_SECRET`) → claim due follow-ups + enqueue `followup.dispatch` → `runWorkflow(cron)` per active tenant → `drainJobs(25)`. Localhost: no cron — use Ask AI.

---

## 8. AI architecture

| Concern | Implementation |
|---|---|
| Providers | `Anthropic, Google Gemini, Groq, Ollama, OpenAI, xAI Grok` (`AIProvider` table; OpenAI/XAI disabled by default). Env keys via `envCredentialFor()`; DB credentials via `AICredential` (encrypted). |
| Modules | 8 keys: `chatbot, lead_extraction, lead_qualification, company_research, complex_analysis, email_drafting, conversation_summary, embeddings`. Each resolved: tenant assignment → platform assignment (`tenantId null` or `"platform"`). Defaults: **Primary Groq `openai/gpt-oss-120b`**, fallback **Ollama `qwen3:8b`** (`scripts/set-default-ai-assignments.js`, `POST …/assignments/defaults`). |
| Gateway | `resolveModelForModule` (honors tenant model overrides) → `getProviderCredential` → `callProvider` (per-provider adapters, Ollama `/api/chat`) → budget check → mock fallback (deterministic `mock-engine`). |
| Kill switches | Global `AISettings.aiEnabled`, per-company `Tenant.aiEnabled`, per-tenant-model `AITenantModel.enabled`, per-model/provider `enabled`, per-module assignment. `isAIEnabled/isAITenantEnabled/isModelEnabledForTenant` gate every call. |
| Budgets | `AIBudget` (platform default `1M tokens / $50 / enforce:false`) checked in `generateText()`; enforce blocks + audits `ai.budget_exceeded`. |
| Usage | `AIUsageLog` + `AICostLog` per call; dashboard `/ai-usage` + Admin → Platform Overview. |
| Test endpoints | `POST /admin/ai/test` (per-module, skip-tested to save tokens), `POST /admin/ai/models/{id}/test`, `POST /admin/ai/providers/{id}/test` (real minimal `OK` prompt, 512 max tokens for reasoning models). |
| Tenant packs | `real-estate.ts` / `software-outreach.ts` — fragments injected into research/qualify/email prompts; `maxResults` respected. |
| Fallback when keys missing | `mockGenerate()` for every module — demos and rate-limit tests still work with zero spend. |

---

## 9. RAG architecture

**Public (homepage + embed)**
- Corpus: `PublicDoc` (DB) seeded from `lib/public-knowledge.ts` — **only** marketing copy (services, features, modes, RE/SW value, pricing/demo). Internal docs never loaded.
- Retrieval: keyword overlap (`retrieveFromList`), top 3, injected as `context` into `generateText(chatbot)` with `SYSTEM_PROMPT` (public-only, refuse stack/secrets, ignore injection).
- Guardrails: `lib/public-guardrails.ts` blocks credentials (`GROQ_API_KEY`…), stacks (Prisma/architecture), clone/reverse-engineer asks, injection (`ignore previous instructions`, `reveal your prompt`, `jailbreak`); output filter redacts secrets + file paths (`app/api`, `prisma/schema`, `lib/ai-gateway`) → `SAFE_REFUSAL`.
- Admin manages corpus live at **Admin → Public Docs** (no deploy).

**Tenant (in-app)**
- Corpus: `KnowledgeDocument` + `KnowledgeChunk` (tenant) + enabled `PublicDoc`s via `retrieveTenantRag()` (`lib/rag.ts`), used by Conversations + chatbots.

**Rate limits:** public chat `30/10min/IP`; bot widget same; conversations `30/min/tenant`; AI routes per-tenant (see §11).

---

## 10. API reference (selected)

**Auth/session:** `GET/POST /api/auth/[...]` (NextAuth), `GET/PUT /api/v1/company-profile`, `GET /api/v1/workspaces`, `ANY /api/v1/agent/takeover`.

**Leads & CRM:** `GET/POST /api/v1/leads`, `GET/PATCH/DELETE /api/v1/leads/{id}`, `POST …/qualify`, `POST …/control`, `POST …/followups`, `GET …/activities`, `POST /api/v1/leads/import` (CSV), `POST /api/v1/leads/ingest` (webhook).

**AI agent:** `GET/POST /api/v1/agent/run` (workflow + metrics), `GET/POST /api/v1/activity`, `GET/POST /api/v1/admin/ai/settings`, `GET/POST /api/v1/admin/ai/test`, `GET/PUT /api/v1/admin/ai/assignments`, `POST …/assignments/defaults`, `GET/POST /api/v1/admin/ai/models` (+ `PUT` bulk, `PATCH [id]`, `POST [id]/test`), providers CRUD/test/keys, `GET/PUT /api/v1/admin/ai/budgets`, `GET /api/v1/admin/ai/usage`.

**Chat & RAG:** `GET/POST /api/v1/conversations`, `GET/POST …/[id]/messages` (handoff), `GET/POST /api/v1/chatbots`, `PATCH/DELETE …/[id]`, `POST /api/v1/public/chat`, `GET/POST /api/v1/public/chat/[key]` (`GET /widget.js`), `GET/POST /api/v1/research/sources|runs`, `GET/POST /api/v1/knowledge/*`.

**Messaging ops:** `GET/POST /api/v1/emails` (generate), `GET/PATCH /api/v1/emails/[id]`, `POST …/approve|reject|send`, `GET /api/v1/followups`, `PATCH …/[id]`, `GET/PATCH /api/v1/meetings[/[id]]`, `GET/POST /api/v1/campaigns*`, `GET /api/v1/admin/public-docs…`, `GET /api/v1/admin/roles…`, `GET/PUT /api/v1/admin/companies/[id]/smtp` (+ `POST …/smtp/test`), `GET/PUT /api/v1/admin/companies/[id]/ai-models`, `POST /api/cron/dispatch-due-jobs`.

**Admin:** `GET /api/v1/admin/companies`, `GET/PATCH/DELETE …/companies/[id]`, `POST …/reset-password`, `GET /api/v1/audit-logs`.

---

## 11. Security, rate limiting & limits

- **Auth:** JWT (NextAuth) — `HttpOnly + SameSite=Lax`, `AUTH_SECRET`. Middleware (`withAuth` with matching `secret`/`pages.signIn`) protects every `/api/*` + `/dashboard … /admin/*` except `/`, `/auth/*`, `/api/health`, `/api/webhooks`, `/api/v1/public/*`. Unauthenticated API → `401`, pages → `307` to `/auth/signin?callbackUrl=…`.
- **Tenant isolation:** `ctx.tenantId` from first `TenantUser` membership; every query filters it. Super-admin bypass only via `requireSuperAdmin`/`assertTenantAccess`.
- **Rate limits (fixed-window, in-memory):**
  - Middleware: `120/min/IP` for `/api/*` → `429 RATE_LIMIT`
  - `agent/run 10/min/tenant`, `research/runs 10/min`, `emails POST 30/min`, `conversations messages 30/min`, `admin/ai/test 20/min/user`, `leads list 120/min`, public chat `30/10min`
  - Login throttle (`login:{email}`, 5/15 min + failures) via `recordFailure/recordSuccess`
- **Headers:** `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection` (config + middleware), HSTS on HTTPS.
- **Secrets:** provider + SMTP passwords encrypted (AES-256-GCM), masked in UI. No key/token in logs, gitignore `.env`, or docs.
- **Budgets:** `AIBudget` platform + per-tenant `enforce` — blocks calls instead of overspending.
- **Phase 5 update (shared limits + webhooks):**
  - `lib/rate-limit.ts` now supports `REDIS_URL` (ioredis) — AI routes use `checkSharedRateLimit([tenant, user], …)` so limits hold across instances; falls back to in-memory when `REDIS_URL` is empty (dev). Middleware (edge) stays in-memory by design.
  - Email **sending** cap: `100/hour/tenant+user` on `POST …/emails/[id]/send`.
  - **Webhooks secured:** `POST /api/webhooks/resend` requires `HMAC-SHA256(WEBHOOK_SECRET or RESEND_WEBHOOK_SECRET, rawBody)` in `x-webhook-signature`, idempotent via `WebhookEvent.externalEventId`, `503` when no secret configured.
  - **Ingest token:** `POST /api/v1/leads/ingest` requires session **or** `X-API-TOKEN`/`Bearer` matching `INGEST_API_KEY` (≥16 chars); session callers are pinned to their own tenant.
  - **Brute-force:** login `5/15 min + failures` (existing) + `401` on bad signatures + `recordAudit webhook.rejected`.
  - **Cross-tenant verified:** IBM user → `admin/companies|settings|roles` all `403`; platform vs IBM leads isolated; unauthenticated API → `401/307` without data leak.
  - **Encrypted-credential rotation:** rotating `CREDENTIAL_ENCRYPTION_KEY` requires re-saving stored secrets (old ciphertext fails `decryptSecret` → verify fails gracefully).

---

## 12. How to run & verify

```bash
npm install
npx prisma db push
npx prisma generate     # after schema changes (stop dev first to avoid DLL lock)
npm run ai:defaults     # Groq primary + Ollama fallback + platform budget
npm run dev             # http://localhost:3000
```

Manual checks used in this repo’s history (live-verified):
- `tmp/test-workflow.js` — Ask AI → leads created/qualified/drafted/pending.
- `npx tsc --noEmit`, `tmp/check-all-pages.js` (34 routes `200`), `tmp/test-public-chat.js` (public answers sourced, injections `blocked:true`).

---

## 13. Known limitations & honest caveats

1. **Research is synthetic.** Leads (e.g. “Rajesh Verma”) are LLM-invented, not scraped from 99acres/MagicBricks/LinkedIn despite `platforms/sources` config. `consentMarketing=false`, no verified contacts. Treat as demo data.
2. **Email send is simulated** without `RESEND_API_KEY` or SMTP. `meta.simulated/model` and the lead-detail warning state this.
3. **Offer matching starts at `0`** if `products/services` are empty — now falls back to RE/SW pack types so it still matches.
4. **Cron is Vercel-only.** Localhost requires explicit triggers.
5. **Multitenancy is app-level**, not DB row-level security. Audit logs are tenant-scoped but must be trusted for compliance.

---

*Generated from the current codebase (`package.json`, `prisma/schema`, `middleware.ts`, `lib/ai-gateway`, `lib/ai/*`, `app/api/v1/**`, admin pages) and live verification runs.*

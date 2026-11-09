const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");
const crypto = require("crypto");
const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const prisma = new PrismaClient();
async function mk(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  const mem = await prisma.tenantUser.findFirst({ where: { userId: user.id } });
  const token = await encode({ token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem?.tenantId ?? null }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  return { cookie: `next-auth.session-token=${token}`, tenantId: mem?.tenantId };
}
(async () => {
  const superA = await mk("shivajitiwari@gmail.com");
  const ibm = await mk("shivajitiwariint@gmail.com");
  const cookieOf = (u) => ({ cookie: u.cookie });
  // 1. Unauth
  let res = await fetch("http://localhost:3000/api/v1/leads?limit=1", { headers: {} });
  console.log("unauth leads", res.status, (await res.text()).slice(0, 120));
  // 2. Cross-tenant: IBM user tries Platform lead (should 404/not found, no leak)
  const platformLead = await prisma.lead.findFirst({ where: { tenantId: "61f1def1-5105-4ace-91e8-285d40216f48" } });
  if (platformLead) {
    res = await fetch(`http://localhost:3000/api/v1/leads/${platformLead.id}`, { headers: cookieOf(ibm) });
    console.log("ibm->platform lead", res.status, (await res.text()).slice(0, 120));
  } else {
    console.log("platform leads none (skip)");
  }
  // 3. Company user hits super-admin only
  res = await fetch("http://localhost:3000/api/v1/admin/companies", { headers: cookieOf(ibm) });
  console.log("ibm->admin companies", res.status, (await res.text()).slice(0, 120));
  res = await fetch("http://localhost:3000/api/v1/admin/ai/settings", { headers: cookieOf(ibm) });
  console.log("ibm->ai settings", res.status, (await res.text()).slice(0, 120));
  res = await fetch("http://localhost:3000/api/v1/admin/roles", { headers: cookieOf(ibm) });
  console.log("ibm->roles", res.status, (await res.text()).slice(0, 120));
  // 4. Rate limit header present
  res = await fetch("http://localhost:3000/api/v1/leads?limit=1", { headers: cookieOf(superA) });
  console.log("ratelimit headers leads", res.status, res.headers.get("x-ratelimit-remaining") || "(no header - memory fallback ok)");
  // 5. Webhook: no secret in dev -> 503 expected
  res = await fetch("http://localhost:3000/api/webhooks/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  console.log("webhook no secret", res.status, (await res.text()).slice(0, 200));
  // 6. Webhook bad signature (set env secret in process? use dummy)
  console.log("REDIS_URL set?", Boolean(process.env.REDIS_URL || env.REDIS_URL));
  console.log("AUTH_SECRET len ok?", (env.AUTH_SECRET || "").length >= 32);
  console.log("CREDENTIAL key len", (env.CREDENTIAL_ENCRYPTION_KEY || "").length);
  // 7. Sensitive logging check: audit metadata should not contain password/token
  const logs = await prisma.auditLog.findMany({ where: { tenantId: "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76" }, orderBy: { createdAt: "desc" }, take: 20 });
  const leak = logs.filter(l => JSON.stringify(l.metadata).includes("password") || JSON.stringify(l.metadata).includes("apiKey"));
  console.log("audit leak check (should be 0-1 debug):", leak.length);
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

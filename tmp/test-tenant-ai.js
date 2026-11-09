const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");
const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: "shivajitiwari@gmail.com" } });
  const mem = await prisma.tenantUser.findFirst({ where: { userId: user.id } });
  const token = await encode({ token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem.tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie = `next-auth.session-token=${token}`;
  const tenantId = "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76";
  let res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/ai-models`, { headers: { cookie } });
  console.log("GET tenant models", res.status, (await res.text()).slice(0, 800));
  res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/ai-models`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ aiEnabled: false }) });
  console.log("PUT master off", res.status, await res.text().then(t=>t.slice(0,300)));
  // workflow for IBM should now pause due to tenant switch
  const user2 = await prisma.user.findUnique({ where: { email: "shivajitiwariint@gmail.com" } });
  const mem2 = await prisma.tenantUser.findFirst({ where: { userId: user2.id } });
  const token2 = await encode({ token: { id: user2.id, sub: user2.id, email: user2.email, status: user2.status, tenantId: mem2.tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie2 = `next-auth.session-token=${token2}`;
  res = await fetch("http://localhost:3000/api/v1/agent/run", { method: "POST", headers: { "Content-Type": "application/json", cookie: cookie2 }, body: JSON.stringify({}) });
  const d = await res.json();
  console.log("workflow tenant-off", res.status, d.status, d.summary, d.steps.map(s=>s.detail));
  // re-enable
  res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/ai-models`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ aiEnabled: true }) });
  console.log("PUT master on", res.status, await res.text().then(t=>t.slice(0,300)));
  // per-model disable Groq
  const models = await prisma.aIModel.findMany({ where: { modelKey: "openai/gpt-oss-120b" } });
  const groqId = models[0].id;
  res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/ai-models`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ models: [{ modelId: groqId, enabled: false }] }) });
  console.log("disable groq for tenant", res.status, await res.text().then(t=>t.slice(0,300)));
  res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/ai-models`, { headers: { cookie } });
  const g = await res.json();
  console.log("tenant models after", g.models.find(m=>m.modelKey==="openai/gpt-oss-120b"));
  // cleanup
  await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/ai-models`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ models: [{ modelId: groqId, enabled: true }] }) });
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

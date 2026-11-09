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
  const token = await encode({
    token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem.tenantId },
    secret: env.AUTH_SECRET, maxAge: 60*60,
  });
  const cookie = `next-auth.session-token=${token}`;
  let res = await fetch("http://localhost:3000/api/v1/admin/ai/settings", { headers: { cookie } });
  console.log("GET settings", res.status, await res.text().then(t => t.slice(0,300)));
  res = await fetch("http://localhost:3000/api/v1/admin/ai/settings", { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ aiEnabled: false }) });
  console.log("PUT disable", res.status, await res.text().then(t => t.slice(0,300)));
  // workflow while disabled should pause with zero tokens
  const user2 = await prisma.user.findUnique({ where: { email: "shivajitiwariint@gmail.com" } });
  const mem2 = await prisma.tenantUser.findFirst({ where: { userId: user2.id } });
  const token2 = await encode({ token: { id: user2.id, sub: user2.id, email: user2.email, status: user2.status, tenantId: mem2.tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie2 = `next-auth.session-token=${token2}`;
  const runRes = await fetch("http://localhost:3000/api/v1/agent/run", { method: "POST", headers: { "Content-Type": "application/json", cookie: cookie2 }, body: JSON.stringify({}) });
  console.log("workflow disabled", runRes.status, await runRes.text().then(t => t.slice(0, 1200)));
  // test endpoint while disabled
  const testRes = await fetch("http://localhost:3000/api/v1/admin/ai/test", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  console.log("test disabled", testRes.status, await testRes.text().then(t => t.slice(0, 800)));
  // public chat while disabled should still answer from docs (no LLM)
  const chatRes = await fetch("http://localhost:3000/api/v1/public/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "How does lead scoring work?" }) });
  console.log("chat disabled", chatRes.status, await chatRes.text().then(t => t.slice(0, 600)));
  // re-enable
  res = await fetch("http://localhost:3000/api/v1/admin/ai/settings", { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ aiEnabled: true }) });
  console.log("PUT re-enable", res.status, await res.text().then(t => t.slice(0,300)));
  // docs
  res = await fetch("http://localhost:3000/api/v1/admin/public-docs", { headers: { cookie } });
  const docsTxt = await res.text();
  console.log("GET docs", res.status, docsTxt.slice(0, 600));
  // bulk disable models then re-enable (without leaving disabled)
  res = await fetch("http://localhost:3000/api/v1/admin/ai/models", { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ enabled: false }) });
  console.log("bulk disable models", res.status, await res.text().then(t => t.slice(0,300)));
  res = await fetch("http://localhost:3000/api/v1/admin/ai/models", { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ enabled: true }) });
  console.log("bulk enable models", res.status, await res.text().then(t => t.slice(0,300)));
  // pages
  for (const p of ["/ai-models", "/ai-providers", "/ai-assignments", "/admin/public-docs", "/"]) {
    const r = await fetch("http://localhost:3000" + p, { headers: { cookie } });
    console.log(p, r.status);
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

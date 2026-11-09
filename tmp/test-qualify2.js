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
  let res = await fetch("http://localhost:3000/api/v1/admin/ai/settings", { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ aiEnabled: true }) });
  console.log("enable", res.status, await res.text());
  // workflow
  const user2 = await prisma.user.findUnique({ where: { email: "shivajitiwariint@gmail.com" } });
  const mem2 = await prisma.tenantUser.findFirst({ where: { userId: user2.id } });
  const token2 = await encode({ token: { id: user2.id, sub: user2.id, email: user2.email, status: user2.status, tenantId: mem2.tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie2 = `next-auth.session-token=${token2}`;
  res = await fetch("http://localhost:3000/api/v1/agent/run", { method: "POST", headers: { "Content-Type": "application/json", cookie: cookie2 }, body: JSON.stringify({}) });
  const data = await res.json();
  console.log("workflow", res.status, JSON.stringify(data.metrics), data.steps.map(s=>s.step+":"+s.detail));
  // qualify one lead - now matching should use RE/SW fallback offers
  const lead = await prisma.lead.findFirst({ where: { tenantId: mem2.tenantId }, orderBy: { createdAt: "desc" } });
  console.log("lead", lead.name, lead.requirement?.slice(0,120));
  res = await fetch(`http://localhost:3000/api/v1/leads/${lead.id}/qualify?leadId=${lead.id}`, { method: "POST", headers: { "Content-Type": "application/json", cookie: cookie2 }, body: JSON.stringify({}) });
  console.log("qualify", res.status, JSON.stringify(await res.json(), null, 2).slice(0, 2500));
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

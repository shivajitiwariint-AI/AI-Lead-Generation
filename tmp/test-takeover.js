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
  const user = await prisma.user.findUnique({ where: { email: "shivajitiwariint@gmail.com" } });
  const mem = await prisma.tenantUser.findFirst({ where: { userId: user.id } });
  const token = await encode({ token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem.tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie = `next-auth.session-token=${token}`;
  // global takeover
  let res = await fetch("http://localhost:3000/api/v1/agent/takeover", { headers: { cookie } });
  console.log("GET takeover", res.status, await res.text());
  res = await fetch("http://localhost:3000/api/v1/agent/takeover", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ automationPaused: true }) });
  console.log("POST pause", res.status, await res.text());
  // workflow should pause
  res = await fetch("http://localhost:3000/api/v1/agent/run", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  console.log("workflow paused", res.status, JSON.stringify(await res.json()).slice(0, 500));
  // per-lead takeover
  const lead = await prisma.lead.findFirst({ where: { tenantId: mem.tenantId } });
  console.log("lead mode before", lead.controlMode);
  res = await fetch(`http://localhost:3000/api/v1/leads/${lead.id}/control`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ controlMode: "manual" }) });
  console.log("PATCH manual", res.status, await res.text().then(t=>t.slice(0,400)));
  res = await fetch(`http://localhost:3000/api/v1/leads/${lead.id}/control`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ controlMode: "ai" }) });
  console.log("PATCH ai", res.status, await res.text().then(t=>t.slice(0,400)));
  // handoff
  res = await fetch("http://localhost:3000/api/v1/conversations", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  const conv = await res.json();
  console.log("create conv", res.status, conv.id);
  res = await fetch(`http://localhost:3000/api/v1/conversations/${conv.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ action: "handoff" }) });
  console.log("handoff", res.status, await res.text().then(t=>t.slice(0,400)));
  // restore
  res = await fetch("http://localhost:3000/api/v1/agent/takeover", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ automationPaused: false }) });
  console.log("POST resume", res.status, await res.text());
  // pages
  for (const p of ["/activity", "/leads", `/leads/${lead.id}`, "/conversations"]) {
    const r = await fetch("http://localhost:3000" + p, { headers: { cookie } });
    console.log(p, r.status);
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

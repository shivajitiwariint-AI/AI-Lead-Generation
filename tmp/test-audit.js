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
  let res = await fetch("http://localhost:3000/api/v1/leads", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ name: "AUDIT TEST", email: "audit@test.com" }) });
  const lead = await res.json();
  console.log("create", res.status, lead.id);
  const audits = await prisma.auditLog.findMany({ where: { tenantId: mem.tenantId, targetId: lead.id }, orderBy: { createdAt: "desc" } });
  console.log("audits for lead", JSON.stringify(audits.map(a => a.action + ":" + a.category), null, 2));
  res = await fetch(`http://localhost:3000/api/v1/leads/${lead.id}`, { method: "DELETE", headers: { cookie } });
  console.log("delete", res.status, await res.text());
  const audits2 = await prisma.auditLog.findMany({ where: { tenantId: mem.tenantId, targetId: lead.id }, orderBy: { createdAt: "desc" } });
  console.log("audits after delete", JSON.stringify(audits2.map(a => a.action), null, 2));
  // check audit-logs api
  res = await fetch("http://localhost:3000/api/v1/audit-logs?limit=3", { headers: { cookie } });
  console.log("audit-logs", res.status, (await res.text()).slice(0, 500));
  for (const p of ["/audit-logs", "/activity"]) {
    const r = await fetch("http://localhost:3000" + p, { headers: { cookie } });
    console.log(p, r.status);
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

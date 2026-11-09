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
  const lead = await prisma.lead.findFirst({ where: { tenantId: mem.tenantId, status: "qualified" }, orderBy: { score: "desc" } });
  console.log("lead", lead.name, lead.requirement?.slice(0,120));
  const res = await fetch(`http://localhost:3000/api/v1/leads/${lead.id}/qualify?leadId=${lead.id}`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  const data = await res.json();
  console.log(res.status, JSON.stringify(data, null, 2).slice(0, 2000));
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

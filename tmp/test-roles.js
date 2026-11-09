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
  for (const p of ["/api/v1/admin/roles", "/api/v1/admin/ai/usage?startDate=2026-10-01T00:00:00.000Z&endDate=2026-11-09T00:00:00.000Z", "/api/v1/admin/ai/budgets"]) {
    const r = await fetch("http://localhost:3000" + p, { headers: { cookie } });
    console.log(p, r.status, (await r.text()).slice(0, 700));
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

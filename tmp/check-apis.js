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
  const mk = async (email) => {
    const user = await prisma.user.findUnique({ where: { email } });
    const mem = await prisma.tenantUser.findFirst({ where: { userId: user.id } });
    const token = await encode({
      token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem.tenantId },
      secret: env.AUTH_SECRET, maxAge: 60*60,
    });
    return { cookie: `next-auth.session-token=${token}`, email };
  };
  const superA = await mk("shivajitiwari@gmail.com");
  const company = await mk("shivajitiwariint@gmail.com");
  const apis = [
    "/api/v1/leads?page=1&limit=5",
    "/api/v1/agent/run?limit=2",
    "/api/v1/company-profile",
    "/api/v1/search-schedules?tenantId=b85fcf2b-4820-48ed-b6b3-06c0b29a0d76",
    "/api/v1/real-estate?tenantId=b85fcf2b-4820-48ed-b6b3-06c0b29a0d76",
    "/api/v1/software-outreach?tenantId=b85fcf2b-4820-48ed-b6b3-06c0b29a0d76",
    "/api/v1/admin/companies",
    "/api/v1/activity?limit=3",
    "/api/v1/research/runs",
    "/api/v1/research/sources",
    "/api/v1/emails?limit=3",
  ];
  for (const a of apis) {
    for (const u of [superA, company]) {
      const res = await fetch("http://localhost:3000" + a, { headers: { cookie: u.cookie } });
      const txt = (await res.text()).slice(0, 120).replace(/\s+/g, " ");
      console.log(`${u.email} ${a} -> ${res.status} ${txt}`);
    }
  }
  // pages for superadmin
  for (const p of ["/admin/companies", "/ai-assignments", "/activity", "/research"]) {
    const res = await fetch("http://localhost:3000" + p, { headers: { cookie: superA.cookie } });
    console.log(`SUPER ${p} -> ${res.status}`);
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

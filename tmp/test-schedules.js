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
    secret: env.AUTH_SECRET,
    maxAge: 60 * 60,
  });
  const cookie = `next-auth.session-token=${token}`;
  const ibm = await prisma.tenant.findUnique({ where: { slug: "ibm" } }).catch(() => null);
  const leaf = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
  console.log("tenants:", leaf);
  // IBM tenant id from earlier context
  const tenantId = "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76";

  let res = await fetch(`http://localhost:3000/api/v1/search-schedules?tenantId=${tenantId}`, { headers: { cookie } });
  console.log("GET schedules", res.status, (await res.text()).slice(0, 2000));

  res = await fetch("http://localhost:3000/api/v1/search-schedules", {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      tenantId,
      schedules: [
        { country: "India", enabled: true, everyHours: 6 },
        { country: "United States", enabled: true, everyHours: 24 },
      ],
    }),
  });
  console.log("PUT schedules", res.status, (await res.text()).slice(0, 2000));

  // Cron run should now respect schedule: India due if last >6h ago, US if >24h
  // Manual run should force both
  const user2 = await prisma.user.findUnique({ where: { email: "shivajitiwariint@gmail.com" } });
  const mem2 = await prisma.tenantUser.findFirst({ where: { userId: user2.id } });
  const token2 = await encode({
    token: { id: user2.id, sub: user2.id, email: user2.email, status: user2.status, tenantId: mem2.tenantId },
    secret: env.AUTH_SECRET,
    maxAge: 60 * 60,
  });
  const cookie2 = `next-auth.session-token=${token2}`;
  const runRes = await fetch("http://localhost:3000/api/v1/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookie2 },
    body: JSON.stringify({}),
  });
  const data = await runRes.json();
  console.log("MANUAL workflow steps:", JSON.stringify(data.steps, null, 2));
  console.log("MANUAL metrics:", JSON.stringify(data.metrics));
  const runs = await prisma.researchRun.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 5 });
  console.log("recent researchRuns:", runs.map(r => ({ loc: r.criteria?.location, status: r.status, created: r.createdCount })));
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

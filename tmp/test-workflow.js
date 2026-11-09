const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "shivajitiwariint@gmail.com" },
  });
  const membership = await prisma.tenantUser.findFirst({
    where: { userId: user.id },
  });
  console.log("tenant", membership?.tenantId, "user", user.id);
  const tenant = await prisma.tenant.findUnique({
    where: { id: membership.tenantId },
  });
  console.log("mode", tenant.operatingMode, "paused", tenant.automationPaused);
  const profile = await prisma.companyProfile.findUnique({
    where: { tenantId: membership.tenantId },
  });
  console.log("profile industry", profile?.industry, "target", JSON.stringify(profile?.targetMarket), "desc", profile?.description);

  const token = await encode({
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      status: user.status,
      tenantId: membership?.tenantId ?? null,
    },
    secret: env.AUTH_SECRET,
    maxAge: 60 * 60,
  });

  console.log("calling POST /api/v1/agent/run (Ask AI / Run workflow)...");
  const res = await fetch("http://localhost:3000/api/v1/agent/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `next-auth.session-token=${token}`,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  console.log("HTTP", res.status);
  console.log(JSON.stringify(data, null, 2).slice(0, 8000));

  const leads = await prisma.lead.findMany({
    where: { tenantId: membership.tenantId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("\nleads now:", leads.length);
  for (const l of leads) {
    console.log(`  ${l.name} | ${l.company} | ${l.email} | status=${l.status} score=${l.score}`);
  }
  const runs = await prisma.researchRun.findMany({
    where: { tenantId: membership.tenantId },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log("\nresearch runs:", JSON.stringify(runs.map(r => ({ status: r.status, found: r.foundCount, created: r.createdCount, error: r.error })), null, 2));
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

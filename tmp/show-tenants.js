const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      operatingMode: true,
      automationPaused: true,
    },
  });
  for (const t of tenants) {
    const [leads, researchRuns, agentRuns] = await Promise.all([
      prisma.lead.count({ where: { tenantId: t.id } }),
      prisma.researchRun.count({ where: { tenantId: t.id } }),
      prisma.agentRun.count({ where: { tenantId: t.id } }),
    ]);
    console.log(
      `${t.name}: mode=${t.operatingMode} paused=${t.automationPaused} leads=${leads} researchRuns=${researchRuns} agentRuns=${agentRuns}`
    );
  }
})()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

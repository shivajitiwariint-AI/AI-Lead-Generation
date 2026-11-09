const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const id = "284d72fe-3a6b-4884-88e8-f96de161f1d5";
  const lead = await prisma.lead.findUnique({ where: { id }, include: { activity: true } }).catch(() => null);
  // fallback direct
  const l = await prisma.lead.findUnique({ where: { id } });
  console.log("LEAD:", JSON.stringify(l, null, 2));
  const sources = await prisma.leadSource.findMany({ where: { leadId: id } });
  console.log("SOURCES:", JSON.stringify(sources, null, 2));
  const msgs = await prisma.message.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" } });
  console.log("MESSAGES:", JSON.stringify(msgs, null, 2));
  const runs = await prisma.researchRun.findMany({ where: { tenantId: l?.tenantId }, orderBy: { createdAt: "desc" }, take: 3 });
  console.log("RECENT RESEARCH RUNS:", JSON.stringify(runs.map(r => ({ id: r.id, criteria: r.criteria, status: r.status, found: r.foundCount, created: r.createdCount })), null, 2));
  const uses = await prisma.aIUsageLog.findMany({ where: { tenantId: l?.tenantId }, orderBy: { createdAt: "desc" }, take: 5 });
  console.log("USAGE:", JSON.stringify(uses, null, 2));
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const r = await p.auditLog.findMany({ where: { tenantId: "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76", actorType: "ai" }, take: 1 });
    console.log("ok", r.length);
  } catch (e) {
    console.error(e.message.slice(0, 1500));
  }
})().finally(() => p.$disconnect());

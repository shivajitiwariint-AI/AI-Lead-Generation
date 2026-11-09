const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const [leads, tenants, users] = await Promise.all([p.lead.count(), p.tenant.count(), p.user.count()]);
  console.log({leads, tenants, users});
  const t = await p.tenant.findMany();
  console.log(t.map(x => x.name));
})().finally(() => p.$disconnect());

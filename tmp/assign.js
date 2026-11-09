const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.aIModuleAssignment.findMany({ where: { tenantId: "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76" } }).then(a => {
  console.log(JSON.stringify(a, null, 2));
  return Promise.all(a.map(x => p.aIModel.findUnique({ where: { id: x.modelId } })));
}).then(m => console.log(m.map(x => x && x.modelKey))).finally(() => p.$disconnect());

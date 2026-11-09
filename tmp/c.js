const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.lead.findMany({ select: { name: true, status: true, email: true }, take: 5 }).then(x => console.log(x)).finally(() => p.$disconnect());

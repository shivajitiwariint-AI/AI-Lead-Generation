const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.companyProfile
  .findMany()
  .then((rows) => {
    console.log(JSON.stringify(rows, null, 2).slice(0, 5000));
  })
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

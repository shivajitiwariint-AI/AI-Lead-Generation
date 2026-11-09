const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const t = "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76";
  const profile = await p.companyProfile.findUnique({ where: { tenantId: t } });
  console.log("industry", profile.industry, "target keys", Object.keys(profile.targetMarket || {}), "software enabled", profile.targetMarket?.software?.enabled, "realEstate enabled", profile.targetMarket?.realEstate?.enabled);
  // IBM is real_estate -> disable software pack
  const target = { ...(profile.targetMarket || {}), software: { ...(profile.targetMarket?.software || {}), enabled: false } };
  await p.companyProfile.update({ where: { tenantId: t }, data: { targetMarket: target } });
  console.log("software disabled for IBM");
})().finally(() => p.$disconnect());

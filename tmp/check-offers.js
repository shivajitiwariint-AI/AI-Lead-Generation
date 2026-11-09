const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const profiles = await p.companyProfile.findMany();
  console.log(JSON.stringify(profiles.map(x => ({ tenantId: x.tenantId, products: x.products, services: x.services, properties: x.properties })), null, 2));
  const quals = await p.leadQualificationResult.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log("recent quals matchScore:", quals.map(q => ({ fit: q.fitScore, match: q.matchScore, matched: q.matchedOffers })));
})().finally(() => p.$disconnect());

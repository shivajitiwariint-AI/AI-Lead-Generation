const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const { encode } = require("next-auth/jwt");
const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const prisma = new PrismaClient();
(async () => {
  const tenantId = "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76";
  const superUser = await prisma.user.findUnique({ where: { email: "shivajitiwari@gmail.com" } });
  const superMem = await prisma.tenantUser.findFirst({ where: { userId: superUser.id } });
  const token = await encode({
    token: { id: superUser.id, sub: superUser.id, email: superUser.email, status: superUser.status, tenantId: superMem.tenantId },
    secret: env.AUTH_SECRET, maxAge: 60*60,
  });
  const cookie = `next-auth.session-token=${token}`;
  let res = await fetch(`http://localhost:3000/api/v1/real-estate?tenantId=${tenantId}`, { headers: { cookie } });
  console.log("GET real-estate", res.status, (await res.text()).slice(0, 1500));
  res = await fetch("http://localhost:3000/api/v1/real-estate", {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      tenantId,
      config: {
        enabled: true,
        propertyTypes: ["flats","apartments","commercial properties","office spaces"],
        buyerTypes: ["investors","NRIs","IT employees"],
        platforms: ["LinkedIn","99acres","MagicBricks"],
        keywords: ["looking for flats","apartment buyers"],
        collectFields: ["full name","company name","job title","phone number","email","LinkedIn profile","city/location","property interest","budget range","source platform"],
        outreachTone: "professional, short, human-like, non-spammy",
        outreachMentions: ["available flats","site visits","pricing benefits"],
        outreachRules: ["no aggressive marketing","no bulk spam","no duplicate messages"],
        maxResults: 5,
      },
    }),
  });
  console.log("PUT real-estate", res.status, (await res.text()).slice(0, 1500));

  // Now run manual workflow as company user - should use RE config in research prompt
  const user2 = await prisma.user.findUnique({ where: { email: "shivajitiwariint@gmail.com" } });
  const mem2 = await prisma.tenantUser.findFirst({ where: { userId: user2.id } });
  const token2 = await encode({
    token: { id: user2.id, sub: user2.id, email: user2.email, status: user2.status, tenantId: mem2.tenantId },
    secret: env.AUTH_SECRET, maxAge: 60*60,
  });
  const cookie2 = `next-auth.session-token=${token2}`;
  const runRes = await fetch("http://localhost:3000/api/v1/agent/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookie2 },
    body: JSON.stringify({}),
  });
  const data = await runRes.json();
  console.log("workflow metrics", JSON.stringify(data.metrics));
  console.log("steps", JSON.stringify(data.steps.map(s => s.step+":"+s.detail)));
  const leads = await prisma.lead.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 3 });
  console.log("last leads requirement:", leads.map(l => l.requirement));
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

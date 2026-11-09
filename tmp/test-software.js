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
  let res = await fetch(`http://localhost:3000/api/v1/software-outreach?tenantId=${tenantId}`, { headers: { cookie } });
  console.log("GET software", res.status, (await res.text()).slice(0, 1200));
  res = await fetch("http://localhost:3000/api/v1/software-outreach", {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      tenantId,
      config: {
        enabled: true,
        services: ["website development","admin dashboards","ERP software"],
        targetBusinesses: ["schools","clinics","wholesalers"],
        platforms: ["Google Maps","IndiaMART","LinkedIn"],
        collectFields: ["business name","website","owner/contact name","email","phone number","LinkedIn profile","location"],
        websiteSignals: ["outdated UI","no mobile responsiveness","no ERP functionality"],
        outreachMentions: ["website modernization","ERP systems","automation services"],
        outreachTone: "professional, short, human-like, non-spammy",
        maxResults: 3,
      },
    }),
  });
  console.log("PUT software", res.status, (await res.text()).slice(0, 1200));

  // verify both packs coexist
  res = await fetch(`http://localhost:3000/api/v1/real-estate?tenantId=${tenantId}`, { headers: { cookie } });
  console.log("GET real-estate still", res.status, (await res.text()).slice(0, 800));
  res = await fetch(`http://localhost:3000/api/v1/search-schedules?tenantId=${tenantId}`, { headers: { cookie } });
  console.log("GET schedules", res.status, (await res.text()).slice(0, 800));
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

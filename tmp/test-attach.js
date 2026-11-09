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
  const user = await prisma.user.findUnique({ where: { email: "shivajitiwariint@gmail.com" } });
  const mem = await prisma.tenantUser.findFirst({ where: { userId: user.id } });
  const token = await encode({ token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem.tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie = `next-auth.session-token=${token}`;
  const lead = await prisma.lead.findFirst({ where: { tenantId: mem.tenantId, status: "qualified", email: { not: null } }, orderBy: { createdAt: "desc" } });
  console.log("lead", lead.name, lead.email);
  const profile = await prisma.companyProfile.findUnique({ where: { tenantId: mem.tenantId } });
  console.log("website", profile?.website);
  const res = await fetch("http://localhost:3000/api/v1/emails", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ leadId: lead.id, purpose: "intro", attachments: [{ name: "Price List 2026.pdf", url: "https://example.com/pricelist.pdf" }] }) });
  const data = await res.json();
  console.log("gen", res.status, JSON.stringify(data).slice(0, 1500));
  // check stored meta
  if (data.messageId) {
    const msg = await prisma.message.findUnique({ where: { id: data.messageId } });
    console.log("stored website", msg.meta?.website, "attachments", msg.meta?.attachments);
    console.log("body has website?", msg.body.includes(profile?.website || "___"));
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

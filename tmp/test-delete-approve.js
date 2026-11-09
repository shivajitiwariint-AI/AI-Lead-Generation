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
  const lead = await prisma.lead.findFirst({ where: { tenantId: mem.tenantId, email: { not: null } }, orderBy: { score: "desc" } });
  console.log("lead", lead.name, lead.email);
  // generate should now be pending_review, not approved/sent
  let res = await fetch("http://localhost:3000/api/v1/emails", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ leadId: lead.id, purpose: "intro" }) });
  let data = await res.json();
  console.log("generate", res.status, JSON.stringify(data).slice(0, 800));
  const msgId = data.messageId;
  // send without approve should fail
  res = await fetch(`http://localhost:3000/api/v1/emails/${msgId}/send`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  console.log("send without approve", res.status, await res.text().then(t=>t.slice(0,400)));
  // edit
  res = await fetch(`http://localhost:3000/api/v1/emails/${msgId}`, { method: "PATCH", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ subject: "Edited subject for test", body: "Edited body — please review https://www.oasis.in/ and attachments." }) });
  console.log("edit", res.status, await res.text().then(t=>t.slice(0,500)));
  // approve then send
  res = await fetch(`http://localhost:3000/api/v1/emails/${msgId}/approve`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  console.log("approve", res.status, await res.text().then(t=>t.slice(0,500)));
  res = await fetch(`http://localhost:3000/api/v1/emails/${msgId}/send`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  console.log("send after approve", res.status, await res.text().then(t=>t.slice(0,600)));
  // delete lead
  const tmp = await prisma.lead.create({ data: { tenantId: mem.tenantId, name: "DELETE ME", email: "deleteme@example.com", status: "new", controlMode: "ai" } });
  console.log("created tmp", tmp.id);
  res = await fetch(`http://localhost:3000/api/v1/leads/${tmp.id}`, { method: "DELETE", headers: { cookie } });
  console.log("delete lead", res.status, await res.text().then(t=>t.slice(0,300)));
  const gone = await prisma.lead.findUnique({ where: { id: tmp.id } });
  console.log("gone?", gone === null);
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

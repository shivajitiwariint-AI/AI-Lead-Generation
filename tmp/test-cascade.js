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
  const tenantId = mem.tenantId;
  const token = await encode({ token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie = `next-auth.session-token=${token}`;
  const tmp = await prisma.lead.create({ data: { tenantId, name: "DELETE ME", email: "deleteme@example.com", status: "new", controlMode: "ai" } });
  console.log("created", tmp.id);
  await prisma.message.create({ data: { tenantId, leadId: tmp.id, channel: "email", status: "draft", subject: "x", body: "x", toAddress: tmp.email, generatedBy: "manual" } });
  await prisma.leadSource.create({ data: { tenantId, leadId: tmp.id, sourceType: "manual" } });
  await prisma.leadActivity.create({ data: { tenantId, leadId: tmp.id, activityType: "lead_created", payload: "{}" } });
  await prisma.followupTask.create({ data: { tenantId, leadId: tmp.id, dueAt: new Date(), idempotencyKey: "test-" + Date.now() } });
  console.log("seeded related");
  const res = await fetch(`http://localhost:3000/api/v1/leads/${tmp.id}`, { method: "DELETE", headers: { cookie } });
  console.log("delete", res.status, await res.text().then(t=>t.slice(0,400)));
  const lead = await prisma.lead.findUnique({ where: { id: tmp.id } });
  const msgs = await prisma.message.count({ where: { leadId: tmp.id } });
  const src = await prisma.leadSource.count({ where: { leadId: tmp.id } });
  const act = await prisma.leadActivity.count({ where: { leadId: tmp.id } });
  const fup = await prisma.followupTask.count({ where: { leadId: tmp.id } });
  console.log({ leadGone: lead === null, msgs, src, act, fup });
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

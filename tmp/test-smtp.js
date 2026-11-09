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
  const user = await prisma.user.findUnique({ where: { email: "shivajitiwari@gmail.com" } });
  const mem = await prisma.tenantUser.findFirst({ where: { userId: user.id } });
  const token = await encode({ token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem.tenantId }, secret: env.AUTH_SECRET, maxAge: 60*60 });
  const cookie = `next-auth.session-token=${token}`;
  const tenantId = "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76";
  let res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/smtp`, { headers: { cookie } });
  console.log("GET smtp", res.status, await res.text().then(t=>t.slice(0,400)));
  res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/smtp`, { method: "PUT", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ host: "smtp.invalid.example", port: 587, secure: false, username: "test@example.com", password: "dummy123", fromEmail: "sales@example.com", fromName: "Test Sales", enabled: true }) });
  console.log("PUT smtp", res.status, await res.text().then(t=>t.slice(0,800)));
  res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/smtp`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  console.log("TEST smtp (expect fail for fake host)", res.status, await res.text().then(t=>t.slice(0,400)));
  res = await fetch(`http://localhost:3000/api/v1/admin/companies/${tenantId}/smtp`, { headers: { cookie } });
  console.log("GET after", res.status, await res.text().then(t=>t.slice(0,500)));
  // cleanup test config so prod not broken
  await prisma.smtpConfig.deleteMany({ where: { tenantId } });
  console.log("cleaned test smtp");
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

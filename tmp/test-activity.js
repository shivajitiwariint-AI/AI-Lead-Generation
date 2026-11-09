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
  for (const q of ["", "?actorType=ai", "?category=workflow", "?category=email", "?actorType=ai&category=research"]) {
    const res = await fetch("http://localhost:3000/api/v1/activity?limit=5" + q, { headers: { cookie } });
    const txt = await res.text();
    console.log(q || "(all)", res.status, txt.slice(0, 600));
  }
  const res = await fetch("http://localhost:3000/api/v1/agent/run?limit=2", { headers: { cookie } });
  console.log("runs", res.status, (await res.text()).slice(0, 800));
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

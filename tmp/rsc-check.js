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
  const token = await encode({
    token: { id: user.id, sub: user.id, email: user.email, status: user.status, tenantId: mem.tenantId },
    secret: env.AUTH_SECRET,
    maxAge: 60 * 60,
  });
  const tests = [
    { path: "/leads", headers: { RSC: "1", "Next-Router-State-Tree": "%5B%22%22%5D" } },
    { path: "/leads", headers: {} },
    { path: "/dashboard", headers: { RSC: "1" } },
  ];
  for (const t of tests) {
    const res = await fetch("http://localhost:3000" + t.path, {
      headers: { cookie: `next-auth.session-token=${token}`, ...t.headers },
      redirect: "manual",
    });
    const text = await res.text();
    console.log("\n===", t.path, t.headers.RSC ? "(RSC)" : "(HTML)", "->", res.status, res.headers.get("location") || "");
    console.log("has 404 text:", text.includes("This page could not be found"));
    console.log("has Leads heading markup:", text.includes("Manage your sales pipeline"));
    console.log("has not-found component:", text.includes('"name":"NotFound"'));
    console.log("has NEXT_NOT_FOUND:", text.includes("NEXT_NOT_FOUND"));
    console.log("has missing-suspense error:", /suspense/i.test(text) ? text.match(/.{0,80}suspense.{0,120}/i)?.[0] : "no");
    console.log("snippet:", text.slice(0, 2000).replace(/\n/g, " ").slice(0, 1200));
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

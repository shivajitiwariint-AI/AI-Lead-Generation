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
  const cookie = `next-auth.session-token=${token}`;
  const paths = [
    "/leads",
    "/activity",
    "/dashboard",
    "/api/v1/leads?page=1&limit=10",
    "/api/v1/agent/run?limit=3",
    "/api/v1/company-profile",
    "/api/v1/agent/takeover",
    "/api/v1/activity?limit=5",
  ];
  for (const p of paths) {
    const res = await fetch("http://localhost:3000" + p, {
      headers: { cookie },
      redirect: "manual",
    });
    const text = await res.text();
    const is404page = /<h1>404<\/h1>/.test(text) && !text.includes("Go to dashboard");
    const custom404 = text.includes("The page you opened does not exist");
    console.log(`${p} -> ${res.status} ${res.headers.get("location") ? "loc=" + res.headers.get("location") : ""} 404page=${is404page} custom404=${custom404} len=${text.length}`);
    if (p.startsWith("/api/")) {
      console.log("  body:", text.slice(0, 400).replace(/\s+/g, " "));
    }
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

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
  const user = await prisma.user.findUnique({
    where: { email: "shivajitiwari@gmail.com" },
  });
  const membership = await prisma.tenantUser.findFirst({
    where: { userId: user.id },
  });
  const token = await encode({
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      status: user.status,
      tenantId: membership?.tenantId ?? null,
    },
    secret: env.AUTH_SECRET,
    maxAge: 60 * 60,
  });

  for (const path of ["/leads", "/dashboard", "/leads/new", "/leads/import"]) {
    const res = await fetch("http://localhost:3000" + path, {
      headers: { cookie: `next-auth.session-token=${token}` },
      redirect: "manual",
    });
    const html = await res.text();
    const visible = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    console.log(`\n=== ${path} -> ${res.status} (${res.headers.get("content-type")}) ===`);
    console.log("visible:", visible.slice(0, 500));
    console.log("has default 404 heading:", /404[\s\S]{0,80}This page could not be found/.test(visible));
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

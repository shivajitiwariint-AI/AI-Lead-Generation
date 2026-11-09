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
  const users = await prisma.user.findMany({
    where: {
      email: { in: ["shivajitiwari@gmail.com", "shivajitiwariint@gmail.com"] },
    },
  });
  const memberships = await prisma.tenantUser.findMany();

  const paths = [
    "/dashboard",
    "/leads",
    "/leads/new",
    "/leads/import",
    "/pipeline",
    "/ai-assignments",
    "/ai-models",
  ];

  for (const user of users) {
    const token = await encode({
      token: {
        id: user.id,
        sub: user.id,
        email: user.email,
        status: user.status,
        tenantId:
          memberships.find((m) => m.userId === user.id)?.tenantId ?? null,
      },
      secret: env.AUTH_SECRET,
      maxAge: 60 * 60,
    });

    for (const path of paths) {
      const res = await fetch("http://localhost:3000" + path, {
        headers: { cookie: `next-auth.session-token=${token}` },
        redirect: "manual",
      });
      const text = await res.text();
      const is404 = text.includes("This page could not be found");
      console.log(
        `${user.email} ${path} -> ${res.status}${res.headers.get("location") ? " -> " + res.headers.get("location") : ""}${is404 ? " [404 PAGE]" : ""}`
      );
    }
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

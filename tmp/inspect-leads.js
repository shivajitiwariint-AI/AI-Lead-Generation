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

  for (const path of ["/leads", "/dashboard"]) {
    const res = await fetch("http://localhost:3000" + path, {
      headers: { cookie: `next-auth.session-token=${token}` },
      redirect: "manual",
    });
    const text = await res.text();
    const title = (text.match(/<title>([^<]*)<\/title>/) || [])[1];
    console.log(`\n=== ${path} -> ${res.status} ===`);
    console.log("title:", title);
    console.log("contains 404 text:", text.includes("This page could not be found"));
    console.log("contains not-found markup:", text.includes("__next_error__"));
    console.log(
      "contains Leads heading:",
      text.includes("Lead Management") || text.includes("Leads")
    );
    console.log("body length:", text.length);
    const idx = text.indexOf("This page could not be found");
    if (idx >= 0) {
      console.log("context:", text.slice(Math.max(0, idx - 200), idx + 120));
    }
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

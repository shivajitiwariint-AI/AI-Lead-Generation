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
    secret: env.AUTH_SECRET, maxAge: 60 * 60,
  });
  const cookie = `next-auth.session-token=${token}`;
  const lead = await prisma.lead.findFirst({ where: { tenantId: mem.tenantId }, orderBy: { createdAt: "desc" } });
  console.log("sample lead:", lead?.id);
  const paths = [
    "/",
    "/dashboard",
    "/leads",
    `/leads/${lead.id}`,
    `/leads/${lead.id}/edit`,
    `/leads/${lead.id}/message`,
    `/leads/${lead.id}/followup`,
    "/leads/new",
    "/leads/import",
    "/pipeline",
    "/conversations",
    "/chatbots",
    "/knowledge-base",
    "/follow-ups",
    "/integrations",
    "/team",
    "/reports",
    "/settings",
    "/profile",
    "/research",
    "/emails",
    "/activity",
    "/company",
    "/scoring-profiles",
    "/audit-logs",
    "/jobs",
    "/admin/companies",
    `/admin/companies/${mem.tenantId}`,
    "/ai-assignments",
    "/ai-models",
    "/ai-providers",
    "/ai-usage",
    "/onboarding",
    "/auth/signin",
  ];
  for (const p of paths) {
    const res = await fetch("http://localhost:3000" + p, {
      headers: { cookie },
      redirect: "manual",
    });
    const text = await res.text();
    const hasDefault404 = /<h1>404<\/h1>/.test(text) && !text.includes("Go to dashboard");
    const hasCustom404 = text.includes("The page you opened does not exist") && !text.includes("AI Lead Gen") && !text.includes("Manage your sales pipeline");
    // strip scripts for visible check
    const visible = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    console.log(`${p} -> ${res.status} ${hasDefault404 ? "DEFAULT404" : ""} ${visible.slice(0, 100)}`);
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

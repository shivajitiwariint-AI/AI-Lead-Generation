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
  let res = await fetch("http://localhost:3000/api/v1/chatbots", { headers: { cookie, "X-Tenant-Id": "demo-tenant-id" } });
  console.log("GET chatbots", res.status, (await res.text()).slice(0, 1000));
  res = await fetch("http://localhost:3000/api/v1/chatbots", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ name: "Website RAG Bot", status: "active", settings: { welcomeMessage: "Hi! Ask me about our services." } }) });
  const created = await res.json();
  console.log("POST chatbot", res.status, JSON.stringify(created).slice(0, 800));
  // public config via publicKey
  res = await fetch(`http://localhost:3000/api/v1/public/chat/${created.publicKey}`);
  console.log("GET public config", res.status, await res.text().then(t=>t.slice(0,500)));
  // public chat via key
  res = await fetch(`http://localhost:3000/api/v1/public/chat/${created.publicKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "What services do you offer?" }) });
  console.log("POST public chat via key", res.status, await res.text().then(t=>t.slice(0,800)));
  // conversations RAG
  res = await fetch("http://localhost:3000/api/v1/conversations", { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({}) });
  const conv = await res.json();
  console.log("POST conversation", res.status, JSON.stringify(conv).slice(0,500));
  res = await fetch(`http://localhost:3000/api/v1/conversations/${conv.id}/messages`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ role: "user", content: "What services do you offer?" }) });
  console.log("POST message", res.status, await res.text().then(t=>t.slice(0,1000)));
  for (const p of ["/conversations", "/chatbots", `/chatbots/${created.id}`]) {
    const r = await fetch("http://localhost:3000" + p, { headers: { cookie } });
    console.log(p, r.status);
  }
})().catch(e => console.error(e)).finally(() => prisma.$disconnect());

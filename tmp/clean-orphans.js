const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const msgs = await p.message.findMany({ select: { id: true, leadId: true } });
  let orphan = 0;
  for (const m of msgs) {
    if (!m.leadId) continue;
    const lead = await p.lead.findUnique({ where: { id: m.leadId } });
    if (!lead) {
      await p.message.delete({ where: { id: m.id } });
      orphan++;
    }
  }
  console.log("orphan emails deleted:", orphan);
  const t = "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76";
  console.log({
    leads: await p.lead.count({ where: { tenantId: t } }),
    emailsSent: await p.message.count({ where: { tenantId: t, channel: "email", status: "sent" } }),
    meetings: await p.meeting.count({ where: { tenantId: t } }),
  });
})().finally(() => p.$disconnect());

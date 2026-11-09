const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const t = "b85fcf2b-4820-48ed-b6b3-06c0b29a0d76";
  const leads = await p.lead.count({ where: { tenantId: t } });
  const qualified = await p.lead.count({ where: { tenantId: t, status: "qualified" } });
  const emailsSent = await p.message.count({ where: { tenantId: t, channel: "email", status: "sent" } });
  const meetings = await p.meeting.count({ where: { tenantId: t } });
  const conv = await p.conversation.count({ where: { tenantId: t } });
  const users = await p.tenantUser.count({ where: { tenantId: t } });
  console.log({leads, qualified, emailsSent, meetings, conv, users});
  const byStatus = await p.lead.groupBy({ by: ["status"], where: { tenantId: t }, _count: { _all: true } });
  console.log(JSON.stringify(byStatus, null, 2));
})().finally(() => p.$disconnect());

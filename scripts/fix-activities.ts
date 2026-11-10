import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const industryMapping: Record<string, string> = {
  'software_it': 'softwareit',
  'real_estate': 'realestate',
  'travel_hospitality': 'travelhospitality',
  'retail_wholesale': 'retailwholesale',
  'finance_insurance': 'financeinsurance',
  'professional_services': 'professionalservices',
  'manufacturing_b2b': 'manufacturingb2b',
}

async function main() {
  console.log('Fixing remaining industry values...')

  // Update lead activities - fetch all and filter in JS since Json doesn't support contains
  const activities = await prisma.leadActivity.findMany({
    select: { id: true, payload: true }
  })

  console.log(`Checking ${activities.length} activities...`)

  let updatedCount = 0
  for (const activity of activities) {
    if (!activity.payload || typeof activity.payload !== 'object') continue
    const payloadStr = JSON.stringify(activity.payload)
    let updated = payloadStr
    for (const [oldVal, newVal] of Object.entries(industryMapping)) {
      updated = updated.replace(new RegExp(`\\b${oldVal}\\b`, 'g'), newVal)
    }
    if (updated !== payloadStr) {
      await prisma.leadActivity.update({
        where: { id: activity.id },
        data: { payload: JSON.parse(updated) }
      })
      updatedCount++
      console.log(`Updated activity ${activity.id}`)
    }
  }

  // Update audit logs
  const auditLogs = await prisma.auditLog.findMany({
    select: { id: true, metadata: true }
  })

  console.log(`Checking ${auditLogs.length} audit logs...`)

  for (const log of auditLogs) {
    if (!log.metadata || typeof log.metadata !== 'object') continue
    const metadataStr = JSON.stringify(log.metadata)
    let updated = metadataStr
    for (const [oldVal, newVal] of Object.entries(industryMapping)) {
      updated = updated.replace(new RegExp(`\\b${oldVal}\\b`, 'g'), newVal)
    }
    if (updated !== metadataStr) {
      await prisma.auditLog.update({
        where: { id: log.id },
        data: { metadata: JSON.parse(updated) }
      })
      console.log(`Updated audit log ${log.id}`)
    }
  }

  // Update conversations
  const conversations = await prisma.conversation.findMany({
    select: { id: true, context: true }
  })

  console.log(`Checking ${conversations.length} conversations...`)

  for (const conv of conversations) {
    if (!conv.context || typeof conv.context !== 'object') continue
    const contextStr = JSON.stringify(conv.context)
    let updated = contextStr
    for (const [oldVal, newVal] of Object.entries(industryMapping)) {
      updated = updated.replace(new RegExp(`\\b${oldVal}\\b`, 'g'), newVal)
    }
    if (updated !== contextStr) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { context: JSON.parse(updated) }
      })
      console.log(`Updated conversation ${conv.id}`)
    }
  }

  console.log(`Migration complete! Updated ${updatedCount} activities.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
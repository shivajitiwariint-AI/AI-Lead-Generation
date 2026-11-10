import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Map of old underscore values to new clean values
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
  console.log('Starting industry value migration...')

  // 1. Update leads table - industry field
  const leads = await prisma.lead.findMany({
    where: {
      industry: { in: Object.keys(industryMapping) }
    },
    select: { id: true, industry: true }
  })
  console.log(`Found ${leads.length} leads with underscore industry values`)

  for (const lead of leads) {
    const newValue = industryMapping[lead.industry!] || lead.industry
    if (lead.industry !== newValue) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { industry: newValue }
      })
      console.log(`Updated lead ${lead.id}: ${lead.industry} -> ${newValue}`)
    }
  }

  // 2. Update company profiles table - industry field
  const profiles = await prisma.companyProfile.findMany({
    where: {
      industry: { in: Object.keys(industryMapping) }
    },
    select: { id: true, tenantId: true, industry: true }
  })
  console.log(`Found ${profiles.length} company profiles with underscore industry values`)

  for (const profile of profiles) {
    const newValue = industryMapping[profile.industry!] || profile.industry
    if (profile.industry !== newValue) {
      await prisma.companyProfile.update({
        where: { id: profile.id },
        data: { industry: newValue }
      })
      console.log(`Updated profile ${profile.id}: ${profile.industry} -> ${newValue}`)
    }
  }

  // 3. Update leads - requirement and AI summary text that contains old values
  const allLeads = await prisma.lead.findMany({
    where: {
      OR: [
        { requirement: { contains: 'software_it' } },
        { requirement: { contains: 'real_estate' } },
        { requirement: { contains: 'travel_hospitality' } },
        { requirement: { contains: 'retail_wholesale' } },
        { requirement: { contains: 'finance_insurance' } },
        { requirement: { contains: 'professional_services' } },
      ]
    },
    select: { id: true, requirement: true }
  })

  console.log(`Found ${allLeads.length} leads with underscore text in requirement`)

  for (const lead of allLeads) {
    if (!lead.requirement) continue
    let updated = lead.requirement
    for (const [oldVal, newVal] of Object.entries(industryMapping)) {
      // Replace standalone values and values in text
      updated = updated.replace(new RegExp(`\\b${oldVal}\\b`, 'g'), newVal)
    }
    if (updated !== lead.requirement) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { requirement: updated }
      })
      console.log(`Updated lead ${lead.id} requirement text`)
    }
  }

  // 4. Update messages table - subject and body that contains old values
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { subject: { contains: 'software_it' } },
        { subject: { contains: 'real_estate' } },
        { body: { contains: 'software_it' } },
        { body: { contains: 'real_estate' } },
      ]
    },
    select: { id: true, subject: true, body: true }
  })

  console.log(`Found ${messages.length} messages with underscore text`)

  for (const msg of messages) {
    let subject = msg.subject
    let body = msg.body
    for (const [oldVal, newVal] of Object.entries(industryMapping)) {
      if (subject) subject = subject.replace(new RegExp(`\\b${oldVal}\\b`, 'g'), newVal)
      if (body) body = body.replace(new RegExp(`\\b${oldVal}\\b`, 'g'), newVal)
    }
    if (subject !== msg.subject || body !== msg.body) {
      await prisma.message.update({
        where: { id: msg.id },
        data: {
          ...(subject !== msg.subject ? { subject } : {}),
          ...(body !== msg.body ? { body } : {}),
        }
      })
      console.log(`Updated message ${msg.id}`)
    }
  }

  // 5. Update AI-generated text in lead activities
  const activities = await prisma.leadActivity.findMany({
    where: {
      OR: [
        { payload: { contains: 'software_it' } },
        { payload: { contains: 'real_estate' } },
      ]
    },
    select: { id: true, payload: true }
  })

  console.log(`Found ${activities.length} activities with underscore text`)

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
      console.log(`Updated activity ${activity.id}`)
    }
  }

  console.log('Migration complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create plans
  const starterPlan = await prisma.plan.create({
    data: {
      name: "Starter",
      description: "For small teams getting started",
      limits: { maxLeads: 1000, maxUsers: 5, maxCampaigns: 3 },
      features: ["website_forms", "csv_import", "ai_qualification", "email_drafts"],
      priceMonthly: 4900,
    },
  });

  const growthPlan = await prisma.plan.create({
    data: {
      name: "Growth",
      description: "For growing sales teams",
      limits: { maxLeads: 10000, maxUsers: 25, maxCampaigns: 20 },
      features: ["website_forms", "csv_import", "ai_qualification", "email_drafts", "whatsapp", "chatbot", "rag"],
      priceMonthly: 14900,
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: "Enterprise",
      description: "For large organizations",
      limits: { maxLeads: null, maxUsers: null, maxCampaigns: null },
      features: ["website_forms", "csv_import", "ai_qualification", "email_drafts", "whatsapp", "chatbot", "rag", "byok", "api_access"],
      priceMonthly: 49900,
    },
  });

  // 2. Create permissions
  const permissionKeys = [
    "tenants:read", "tenants:write",
    "users:read", "users:write",
    "roles:read", "roles:write",
    "leads:read", "leads:write", "leads:delete", "leads:export",
    "campaigns:read", "campaigns:write",
    "ai:read", "ai:write",
    "messages:read", "messages:send", "messages:approve",
    "integrations:read", "integrations:write",
    "reports:read", "audit:read", "settings:write",
  ];

  const createdPermissions = await Promise.all(
    permissionKeys.map((key) =>
      prisma.permission.create({
        data: { key, description: `Permission for ${key}` },
      })
    )
  );

  // 3. Create roles (without nested permissions)
  const superAdminRole = await prisma.role.create({
    data: {
      name: "Super Admin",
      type: "SUPER_ADMIN",
      description: "Full platform access across all tenants",
    },
  });

  const companyOwnerRole = await prisma.role.create({
    data: {
      name: "Company Owner",
      type: "COMPANY_OWNER",
      description: "Full access within their company",
    },
  });

  const salesManagerRole = await prisma.role.create({
    data: {
      name: "Sales Manager",
      type: "SALES_MANAGER",
      description: "Manage team pipeline and approve messages",
    },
  });

  const salesRepRole = await prisma.role.create({
    data: {
      name: "Sales Representative",
      type: "SALES_REPRESENTATIVE",
      description: "View assigned leads and manage conversations",
    },
  });

  const analystRole = await prisma.role.create({
    data: {
      name: "Read-only Analyst",
      type: "READ_ONLY_ANALYST",
      description: "View reports and dashboards only",
    },
  });

  // 4. Create RolePermission mappings
  const allPermIds = createdPermissions.map((p) => p.id);

  const managerPermKeys = [
    "leads:read", "leads:write", "campaigns:read", "campaigns:write",
    "messages:read", "messages:send", "messages:approve",
    "reports:read", "integrations:read",
  ];
  const managerPermIds = createdPermissions
    .filter((p) => managerPermKeys.includes(p.key))
    .map((p) => p.id);

  const repPermKeys = ["leads:read", "leads:write", "messages:read", "messages:send"];
  const repPermIds = createdPermissions
    .filter((p) => repPermKeys.includes(p.key))
    .map((p) => p.id);

  const analystPermKeys = ["leads:read", "reports:read", "integrations:read"];
  const analystPermIds = createdPermissions
    .filter((p) => analystPermKeys.includes(p.key))
    .map((p) => p.id);

  await prisma.rolePermission.createMany({
    data: [
      ...allPermIds.map((pid) => ({ roleId: superAdminRole.id, permissionId: pid })),
      ...allPermIds.map((pid) => ({ roleId: companyOwnerRole.id, permissionId: pid })),
      ...managerPermIds.map((pid) => ({ roleId: salesManagerRole.id, permissionId: pid })),
      ...repPermIds.map((pid) => ({ roleId: salesRepRole.id, permissionId: pid })),
      ...analystPermIds.map((pid) => ({ roleId: analystRole.id, permissionId: pid })),
    ],
  });

  // 5. Create default tenant (starter workspace)
  const defaultTenant = await prisma.tenant.create({
    data: {
      name: "Acme Group",
      slug: "acme-group",
      status: "ACTIVE",
      timezone: "UTC",
      planId: growthPlan.id,
    },
  });

  await prisma.subscription.create({
    data: {
      tenantId: defaultTenant.id,
      planId: growthPlan.id,
      status: "ACTIVE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // 6. Create default admin user
  const hashedPassword = await bcrypt.hash("Admin123!", 12);

  const adminUser = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@example.com",
      password: hashedPassword,
      status: "ACTIVE",
      emailVerified: new Date(),
    },
  });

  // 7b. Company profile (requirement 3) + research sources (requirement 4) + budget (req 10)
  await prisma.companyProfile.create({
    data: {
      tenantId: defaultTenant.id,
      industry: "Software and IT",
      website: "https://acme-group.example.com",
      description:
        "Acme Group sells AI-powered lead generation and sales automation software to B2B SMEs.",
      products: [
        { name: "AI Lead Gen Suite", description: "Capture, score and manage leads with AI", keywords: ["lead", "qualification", "scoring", "crm"] },
        { name: "Website Chatbot", description: "24/7 AI chatbot for website visitors", keywords: ["chatbot", "conversational", "website"] },
      ],
      services: [
        { name: "Implementation & onboarding", description: "Setup and training", keywords: ["onboarding", "setup"] },
        { name: "Managed outreach", description: "AI-assisted outreach campaigns", keywords: ["outreach", "campaign", "email"] },
      ],
      properties: [
        { key: "Headquarters", value: "Bengaluru, India" },
        { key: "Team size", value: "25-50" },
        { key: "Founded", value: "2023" },
      ],
      salesObjectives: [
        { objective: "Book 30 qualified meetings this quarter", targetMetric: "30 meetings", horizon: "Q1" },
        { objective: "Convert 10% of qualified leads to customers", targetMetric: "10% conversion", horizon: "Q1" },
      ],
      targetMarket: {
        segments: ["SMEs", "Agencies", "B2B SaaS"],
        locations: ["India", "UAE", "UK"],
        notes: "Decision makers: founders, sales heads, RevOps leads.",
      },
      onboardingCompleted: true,
    },
  });

  await prisma.researchSource.createMany({
    data: [
      { tenantId: defaultTenant.id, name: "Approved B2B directory", sourceType: "directory", url: "https://example.com/directory", approved: true },
      { tenantId: defaultTenant.id, name: "Industry web search", sourceType: "search", approved: true },
    ],
  });

  await prisma.aIBudget.create({
    data: {
      tenantId: defaultTenant.id,
      monthlyTokenLimit: 1000000,
      monthlyCostLimit: 50,
      alertThreshold: 0.8,
      enforce: false,
    },
  });

  // 8. Create industries
  const industries = [
    { key: "softwareit", name: "Software and IT", description: "ERP, CRM, HRMS, billing software, website, mobile app, AI automation" },
    { key: "realestate", name: "Real Estate", description: "Buy, sell, rent property; residential flats, plots, commercial" },
    { key: "retailwholesale", name: "Readymade Products and Retail", description: "Clothing, furniture, electronics, appliances, machinery, wholesale" },
    { key: "education", name: "Education", description: "School/college admission, coaching, certification, training" },
    { key: "healthcare", name: "Healthcare", description: "Clinic appointments, diagnostic services, healthcare packages" },
    { key: "travelhospitality", name: "Travel and Hospitality", description: "Holiday packages, hotel bookings, visa assistance, tours" },
    { key: "financeinsurance", name: "Finance and Insurance", description: "Business finance, loans, insurance enquiries" },
    { key: "professionalservices", name: "Professional Services", description: "Digital marketing, SEO, accounting, consulting, recruitment, legal" },
    { key: "manufacturing_b2b", name: "Manufacturing and B2B", description: "Raw materials, industrial equipment, contract manufacturing, distribution" },
    { key: "custom", name: "Other / Custom", description: "Any company-defined product or service" },
  ];

  for (const ind of industries) {
    await prisma.industry.create({ data: ind });
  }

  // 9. Create AI providers
  const providers = [
    { providerKey: "anthropic", displayName: "Anthropic Claude", enabled: true },
    { providerKey: "google_gemini", displayName: "Google Gemini", enabled: true },
    { providerKey: "xai_grok", displayName: "xAI Grok", enabled: true },
    { providerKey: "ollama", displayName: "Ollama", enabled: true },
    { providerKey: "openai", displayName: "OpenAI", enabled: false },
  ];

  for (const p of providers) {
    await prisma.aIProvider.create({ data: p });
  }

  console.log("✅ Seed completed");
  console.log(`   Admin: admin@example.com / Admin123!`);
  console.log(`   Tenant: ${defaultTenant.name} (${defaultTenant.slug})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

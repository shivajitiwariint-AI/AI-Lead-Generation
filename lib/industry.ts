// Shared industry label mapping
export const INDUSTRY_LABELS: Record<string, string> = {
  softwareit: "Software It",
  software_it: "Software It",
  realestate: "Real Estate",
  real_estate: "Real Estate",
  travelhospitality: "Travel Hospitality",
  travel_hospitality: "Travel Hospitality",
  retailwholesale: "Retail Wholesale",
  retail_wholesale: "Retail Wholesale",
  education: "Education",
  healthcare: "Healthcare",
  financeinsurance: "Finance Insurance",
  finance_insurance: "Finance Insurance",
  professionalservices: "Professional Services",
  professional_services: "Professional Services",
  manufacturingb2b: "Manufacturing B2B",
  manufacturing_b2b: "Manufacturing B2B",
  custom: "Other / Custom",
};

export function formatIndustry(value?: string | null): string {
  if (!value) return "—";
  // Try direct lookup first
  if (INDUSTRY_LABELS[value]) return INDUSTRY_LABELS[value];
  // Fall back to underscore removal + Title Case
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
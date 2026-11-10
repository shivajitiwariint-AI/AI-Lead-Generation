// Shared industry label mapping
export const INDUSTRY_LABELS: Record<string, string> = {
  softwareit: "Software It",
  realestate: "Real Estate",
  travelhospitality: "Travel Hospitality",
  retailwholesale: "Retail Wholesale",
  education: "Education",
  healthcare: "Healthcare",
  financeinsurance: "Finance Insurance",
  professionalservices: "Professional Services",
  manufacturingb2b: "Manufacturing B2B",
  custom: "Other / Custom",
};

export function formatIndustry(value?: string | null): string {
  if (!value) return "—";
  return INDUSTRY_LABELS[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
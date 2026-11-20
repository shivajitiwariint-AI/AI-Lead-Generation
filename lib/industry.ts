// Shared industry labels + helpers.
// Stored values are lowercase and underscore-free (e.g. "softwareit").
// Legacy underscore values are still mapped so old records render correctly.

export const INDUSTRY_LABELS: Record<string, string> = {
  softwareit: "Software & IT",
  software_it: "Software & IT",
  realestate: "Real Estate",
  real_estate: "Real Estate",
  travelhospitality: "Travel & Hospitality",
  travel_hospitality: "Travel & Hospitality",
  retailwholesale: "Retail & Wholesale",
  retail_wholesale: "Retail & Wholesale",
  education: "Education",
  healthcare: "Healthcare",
  financeinsurance: "Finance & Insurance",
  finance_insurance: "Finance & Insurance",
  professionalservices: "Professional Services",
  professional_services: "Professional Services",
  manufacturingb2b: "Manufacturing & B2B",
  manufacturing_b2b: "Manufacturing & B2B",
  custom: "Other / Custom",
};

/** Canonical options for pickers, in display order. */
export const INDUSTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "softwareit", label: "Software & IT" },
  { value: "realestate", label: "Real Estate" },
  { value: "retailwholesale", label: "Retail & Wholesale" },
  { value: "education", label: "Education" },
  { value: "healthcare", label: "Healthcare" },
  { value: "travelhospitality", label: "Travel & Hospitality" },
  { value: "financeinsurance", label: "Finance & Insurance" },
  { value: "professionalservices", label: "Professional Services" },
  { value: "manufacturingb2b", label: "Manufacturing & B2B" },
  { value: "custom", label: "Other / Custom" },
];

export function formatIndustry(value?: string | null): string {
  if (!value) return "—";
  const clean = value.trim();
  if (!clean) return "—";
  // Try direct lookup first (covers both clean and legacy underscore keys).
  if (INDUSTRY_LABELS[clean]) return INDUSTRY_LABELS[clean];
  // Fall back to underscore removal + Title Case.
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

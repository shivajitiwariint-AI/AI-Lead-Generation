"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Building, Target, MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  industry: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  requirement: z.string().optional().or(z.literal("")),
});

type LeadFormData = z.infer<typeof leadSchema>;

const INDUSTRIES = [
  "Software and IT",
  "Real Estate",
  "Readymade Products and Retail",
  "Education",
  "Healthcare",
  "Travel and Hospitality",
  "Finance and Insurance",
  "Professional Services",
  "Manufacturing and B2B",
  "Other / Custom",
];

export default function NewLeadPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<LeadFormData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    industry: "",
    location: "",
    requirement: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key: keyof LeadFormData, value: string) => {
    setFormData({ ...formData, [key]: value });
    const nextErrors = { ...errors };
    delete nextErrors[key];
    setErrors(nextErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate on the client before hitting the API
    const parsed = leadSchema.safeParse(formData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setSubmitting(false);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          company: formData.company || null,
          website: formData.website || null,
          industry: formData.industry || null,
          location: formData.location || null,
          requirement: formData.requirement || null,
          status: "new",
        }),
      });

      if (res.ok) {
        router.push("/leads");
      } else {
        const error = await res.json();
        setErrors({ general: error.error?.message || "Failed to create lead" });
      }
    } catch {
      setErrors({ general: "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/leads" className="text-primary hover:underline">
          <ArrowLeft className="h-4 w-4 mr-1" /> Leads
        </Link>
        <span className="mx-2">/</span>
        <span>New Lead</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="rahul@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && <p className="text-destructive text-xs">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  placeholder="ABC Technologies"
                  value={formData.company}
                  onChange={(e) => handleChange("company", e.target.value)}
                  className={errors.company ? "border-destructive" : ""}
                />
                {errors.company && <p className="text-destructive text-xs">{errors.company}</p>}
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  className={errors.website ? "border-destructive" : ""}
                />
                {errors.website && <p className="text-destructive text-xs">{errors.website}</p>}
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  placeholder="Select industry"
                  value={formData.industry}
                  onChange={(e) => handleChange("industry", e.target.value)}
                  className={errors.industry ? "border-destructive" : ""}
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  {INDUSTRIES.map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => handleChange("industry", ind)}
                      className="text-xs px-2 py-1 rounded border border-border bg-background hover:bg-accent/50 transition-colors"
                    >
                      {ind}
                    </button>
                  ))}
                </div>
                {errors.industry && <p className="text-destructive text-xs">{errors.industry}</p>}
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="City, State"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  className={errors.location ? "border-destructive" : ""}
                />
                {errors.location && <p className="text-destructive text-xs">{errors.location}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Requirement / Notes</Label>
              <textarea
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                rows={4}
                placeholder="e.g. Looking for ERP software for manufacturing company with 200 users"
                value={formData.requirement}
                onChange={(e) => handleChange("requirement", e.target.value)}
              />
              {errors.requirement && <p className="text-destructive text-xs">{errors.requirement}</p>}
            </div>

            {errors.general && (
              <div className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
                {errors.general}
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Link href="/leads" className="text-sm text-muted-foreground hover:underline">
                Cancel
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Lead"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

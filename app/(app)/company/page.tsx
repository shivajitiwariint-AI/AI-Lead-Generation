"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Building2 } from "lucide-react";
import { toast } from "sonner";

type Offer = { name: string; description?: string; keywords?: string[] };
type Objective = { objective: string; targetMetric?: string; horizon?: string };
const INDUSTRY_LABELS: Record<string, string> = {
  softwareit: "Software & IT",
  real_estate: "Real Estate",
  retail_wholesale: "Retail & Wholesale",
  education: "Education",
  healthcare: "Healthcare",
  travel_hospitality: "Travel & Hospitality",
  finance_insurance: "Finance & Insurance",
  professional_services: "Professional Services",
  manufacturing_b2b: "Manufacturing & B2B",
  custom: "Other / Custom",
};

function industryLabel(value: string | null | undefined): string {
  if (!value) return "";
  return INDUSTRY_LABELS[value] ?? value;
}

type Property = { key: string; value: string };

interface Profile {
  industry?: string | null;
  website?: string | null;
  description?: string | null;
  products?: Offer[] | null;
  services?: Offer[] | null;
  properties?: Property[] | null;
  salesObjectives?: Objective[] | null;
  targetMarket?: { segments?: string[]; locations?: string[]; notes?: string } | null;
}

export default function CompanyPage() {
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/company-profile");
        if (res.ok) {
          const data = await res.json();
          if (data && data.industry) data.industry = industryLabel(data.industry);
          setProfile(data ?? {});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Company profile saved");
    } catch {
      toast.error("Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const addItem = (key: "products" | "services", item: Offer) =>
    update({ [key]: [...(profile[key] ?? []), item] } as any);
  const removeItem = (key: "products" | "services", i: number) =>
    update({ [key]: (profile[key] ?? []).filter((_, idx) => idx !== i) } as any);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Company Registration</h1>
          <p className="text-muted-foreground">
            Define your industry, products, services, properties and sales objectives. The AI uses this to qualify and match leads.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
            <CardDescription>Who you are and what you sell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={profile.industry ?? ""}
                onChange={(e: any) => update({ industry: e.target.value })}
                placeholder="e.g. Real Estate, SaaS, Manufacturing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={profile.website ?? ""}
                onChange={(e: any) => update({ website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Company description</Label>
              <Textarea
                id="description"
                value={profile.description ?? ""}
                onChange={(e: any) => update({ description: e.target.value })}
                placeholder="What you do, who you serve, your differentiators"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Target Market</CardTitle>
            <CardDescription>Who the AI should look for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Segments (comma separated)</Label>
              <Input
                value={(profile.targetMarket?.segments ?? []).join(", ")}
                onChange={(e: any) =>
                  update({
                    targetMarket: {
                      ...(profile.targetMarket ?? {}),
                      segments: e.target.value
                        .split(",")
                        .map((s: string) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                placeholder="SMEs, Enterprise, Agencies"
              />
            </div>
            <div className="space-y-2">
              <Label>Locations (comma separated)</Label>
              <Input
                value={(profile.targetMarket?.locations ?? []).join(", ")}
                onChange={(e: any) =>
                  update({
                    targetMarket: {
                      ...(profile.targetMarket ?? {}),
                      locations: e.target.value
                        .split(",")
                        .map((s: string) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                placeholder="India, UAE, UK"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={profile.targetMarket?.notes ?? ""}
                onChange={(e: any) =>
                  update({
                    targetMarket: { ...(profile.targetMarket ?? {}), notes: e.target.value },
                  })
                }
                rows={3}
                placeholder="Ideal customer profile notes"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Products</CardTitle>
            <CardDescription>Offer catalog used for lead matching</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addItem("products", { name: "", description: "", keywords: [] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(profile.products ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          )}
          {(profile.products ?? []).map((p, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
              <Input
                placeholder="Product name"
                value={p.name}
                onChange={(e: any) => {
                  const next = [...(profile.products ?? [])];
                  next[i] = { ...next[i], name: e.target.value };
                  update({ products: next });
                }}
              />
              <Input
                placeholder="Description"
                value={p.description ?? ""}
                onChange={(e: any) => {
                  const next = [...(profile.products ?? [])];
                  next[i] = { ...next[i], description: e.target.value };
                  update({ products: next });
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Keywords (comma)"
                  value={(p.keywords ?? []).join(", ")}
                  onChange={(e: any) => {
                    const next = [...(profile.products ?? [])];
                    next[i] = {
                      ...next[i],
                      keywords: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean),
                    };
                    update({ products: next });
                  }}
                />
                <Button size="icon" variant="ghost" onClick={() => removeItem("products", i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Services</CardTitle>
            <CardDescription>Services you offer</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addItem("services", { name: "", description: "", keywords: [] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(profile.services ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No services yet.</p>
          )}
          {(profile.services ?? []).map((s, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
              <Input
                placeholder="Service name"
                value={s.name}
                onChange={(e: any) => {
                  const next = [...(profile.services ?? [])];
                  next[i] = { ...next[i], name: e.target.value };
                  update({ services: next });
                }}
              />
              <Input
                placeholder="Description"
                value={s.description ?? ""}
                onChange={(e: any) => {
                  const next = [...(profile.services ?? [])];
                  next[i] = { ...next[i], description: e.target.value };
                  update({ services: next });
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Keywords (comma)"
                  value={(s.keywords ?? []).join(", ")}
                  onChange={(e: any) => {
                    const next = [...(profile.services ?? [])];
                    next[i] = {
                      ...next[i],
                      keywords: e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean),
                    };
                    update({ services: next });
                  }}
                />
                <Button size="icon" variant="ghost" onClick={() => removeItem("services", i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Properties</CardTitle>
            <CardDescription>Key/value attributes (locations, certifications, capacity, …)</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({ properties: [...(profile.properties ?? []), { key: "", value: "" }] })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(profile.properties ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No properties yet.</p>
          )}
          {(profile.properties ?? []).map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Key (e.g. Headquarters)"
                value={p.key}
                onChange={(e: any) => {
                  const next = [...(profile.properties ?? [])];
                  next[i] = { ...next[i], key: e.target.value };
                  update({ properties: next });
                }}
              />
              <Input
                placeholder="Value"
                value={p.value}
                onChange={(e: any) => {
                  const next = [...(profile.properties ?? [])];
                  next[i] = { ...next[i], value: e.target.value };
                  update({ properties: next });
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  update({ properties: (profile.properties ?? []).filter((_, idx) => idx !== i) })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sales Objectives</CardTitle>
            <CardDescription>What the AI should optimise for</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => update({ salesObjectives: [...(profile.salesObjectives ?? []), { objective: "" }] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(profile.salesObjectives ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No objectives yet.</p>
          )}
          {(profile.salesObjectives ?? []).map((o, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
              <Input
                placeholder="Objective (e.g. Close 20 deals)"
                value={o.objective}
                onChange={(e: any) => {
                  const next = [...(profile.salesObjectives ?? [])];
                  next[i] = { ...next[i], objective: e.target.value };
                  update({ salesObjectives: next });
                }}
              />
              <Input
                placeholder="Target metric"
                value={o.targetMetric ?? ""}
                onChange={(e: any) => {
                  const next = [...(profile.salesObjectives ?? [])];
                  next[i] = { ...next[i], targetMetric: e.target.value };
                  update({ salesObjectives: next });
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Horizon (e.g. Q1)"
                  value={o.horizon ?? ""}
                  onChange={(e: any) => {
                    const next = [...(profile.salesObjectives ?? [])];
                    next[i] = { ...next[i], horizon: e.target.value };
                    update({ salesObjectives: next });
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    update({ salesObjectives: (profile.salesObjectives ?? []).filter((_, idx) => idx !== i) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

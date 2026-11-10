"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Check, ChevronLeft, ChevronRight, Sparkles, Bot, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AiBackground } from "@/components/ai-background";
import { formatIndustry } from "@/lib/industry";
import { CountrySelect } from "@/components/country-select";
import { cn } from "@/lib/utils";

const SEGMENT_OPTIONS = ["SMEs", "Agencies", "B2B SaaS", "Startups", "Mid-market", "Enterprise"];

const INDUSTRIES = [
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

const STEPS = [
  { title: "Configure Business", desc: "Tell us about your company" },
  { title: "Add Products & Services", desc: "Your offer catalog" },
  { title: "Define Target Customers", desc: "Who the AI should find" },
  { title: "Configure AI", desc: "How the AI should act" },
  { title: "Open Dashboard", desc: "You're ready to go" },
];

type Offer = { name: string; description?: string; keywords?: string[] };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<any>({});
  const [mode, setMode] = useState("AI_WITH_APPROVAL");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/company-profile");
        if (res.ok) {
          const data = await res.json();
          if (data?.isSuperAdmin) {
            router.replace("/dashboard");
            return;
          }
          setProfile(data ?? {});
          setMode((await fetch("/api/v1/agent/takeover").then((r) => r.json()).catch(() => ({})))?.operatingMode ?? "AI_WITH_APPROVAL");
          setPaused((await fetch("/api/v1/agent/takeover").then((r) => r.json()).catch(() => ({})))?.automationPaused ?? false);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (patch: any) => setProfile((p: any) => ({ ...p, ...patch }));

  const [customSegment, setCustomSegment] = useState("");

  const toggleMulti = (key: "segments" | "locations", value: string) => {
    const list: string[] = profile.targetMarket?.[key] ?? [];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    update({ targetMarket: { ...(profile.targetMarket ?? {}), [key]: next } });
  };

  const addCustom = (key: "segments" | "locations", value: string) => {
    const v = value.trim();
    if (!v) return;
    const list: string[] = profile.targetMarket?.[key] ?? [];
    if (list.includes(v)) return;
    update({ targetMarket: { ...(profile.targetMarket ?? {}), [key]: [...list, v] } });
  };

  const saveProfile = async (patch?: any) => {
    const data = patch ? { ...profile, ...patch } : profile;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      setProfile(saved ?? data);
      return true;
    } catch {
      toast.error("Could not save. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveMode = async (m: string, p: boolean) => {
    try {
      await fetch("/api/v1/agent/takeover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatingMode: m, automationPaused: p }),
      });
    } catch {
      /* ignore */
    }
  };

  const addItem = (key: "products" | "services", item: Offer) =>
    update({ [key]: [...(profile[key] ?? []), item] });
  const removeItem = (key: "products" | "services", i: number) =>
    update({ [key]: (profile[key] ?? []).filter((_: any, idx: number) => idx !== i) });

  const next = async () => {
    let ok = true;
    if (step === 0) ok = await saveProfile();
    else if (step === 1) ok = await saveProfile();
    else if (step === 2) ok = await saveProfile();
    else if (step === 3) {
      await saveMode(mode, paused);
      ok = true;
    }
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = async () => {
    setSaving(true);
    try {
      const ok = await saveProfile({ onboardingCompleted: true });
      if (!ok) {
        toast.error("Couldn't save onboarding. Please try again.");
        return;
      }
      await saveMode(mode, paused);
      toast.success("You're all set! Redirecting to your dashboard…");
      setTimeout(() => router.replace("/dashboard"), 600);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] px-4 py-10">
      <AiBackground />
      <div className="relative z-10 w-full max-w-2xl animate-fade-up">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30 animate-pulse-glow">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Welcome to AI Lead Gen</h1>
          <p className="mt-1 text-sm text-white/60">Let's set up your workspace in 5 quick steps</p>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
                    i < step
                      ? "border-emerald-400 bg-emerald-400 text-black"
                      : i === step
                        ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                        : "border-white/20 bg-white/5 text-white/40"
                  }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`mt-1 hidden text-[10px] sm:block ${i === step ? "text-white" : "text-white/40"}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 transition-colors ${i < step ? "bg-emerald-400" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">
              Step {step + 1} of {STEPS.length}: {STEPS[step].title}
            </CardTitle>
            <CardDescription className="text-white/60">{STEPS[step].desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-white/80">Company type / industry</Label>
                  <Select value={profile.industry ?? ""} onValueChange={(v: any) => update({ industry: v })}>
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Please select" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0b1024] text-white">
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind.value} value={ind.value} className="text-white focus:bg-white/10 focus:text-white">
                          {ind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Website</Label>
                  <Input
                    value={profile.website ?? ""}
                    onChange={(e: any) => update({ website: e.target.value })}
                    placeholder="https://example.com"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Company description</Label>
                  <Textarea
                    value={profile.description ?? ""}
                    onChange={(e: any) => update({ description: e.target.value })}
                    placeholder="What you do, who you serve, your differentiators"
                    rows={4}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/70">Products</p>
                  <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => (addItem as any)("products", { name: "", description: "", keywords: [] })}>
                    + Add product
                  </Button>
                </div>
                <div className="space-y-2">
                  {(profile.products ?? []).map((p: any, i: number) => (
                    <div key={i} className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-3">
                      <Input placeholder="Name" value={p.name} onChange={(e: any) => { const n = [...(profile.products ?? [])]; n[i] = { ...n[i], name: e.target.value }; update({ products: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                      <Input placeholder="Description" value={p.description ?? ""} onChange={(e: any) => { const n = [...(profile.products ?? [])]; n[i] = { ...n[i], description: e.target.value }; update({ products: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                      <Input placeholder="Keywords (comma)" value={(p.keywords ?? []).join(", ")} onChange={(e: any) => { const n = [...(profile.products ?? [])]; n[i] = { ...n[i], keywords: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }; update({ products: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                    </div>
                  ))}
                  {(profile.products ?? []).length === 0 && <p className="text-xs text-white/40">No products yet. Click "Add product".</p>}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-white/70">Services</p>
                  <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => (addItem as any)("services", { name: "", description: "", keywords: [] })}>
                    + Add service
                  </Button>
                </div>
                <div className="space-y-2">
                  {(profile.services ?? []).map((s: any, i: number) => (
                    <div key={i} className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:grid-cols-3">
                      <Input placeholder="Name" value={s.name} onChange={(e: any) => { const n = [...(profile.services ?? [])]; n[i] = { ...n[i], name: e.target.value }; update({ services: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                      <Input placeholder="Description" value={s.description ?? ""} onChange={(e: any) => { const n = [...(profile.services ?? [])]; n[i] = { ...n[i], description: e.target.value }; update({ services: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                      <Input placeholder="Keywords (comma)" value={(s.keywords ?? []).join(", ")} onChange={(e: any) => { const n = [...(profile.services ?? [])]; n[i] = { ...n[i], keywords: e.target.value.split(",").map((x: string) => x.trim()).filter(Boolean) }; update({ services: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                    </div>
                  ))}
                  {(profile.services ?? []).length === 0 && <p className="text-xs text-white/40">No services yet. Click "Add service".</p>}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label className="text-white/80">Target segments</Label>
                  <div className="flex flex-wrap gap-2">
                    {SEGMENT_OPTIONS.map((s) => {
                      const selected = (profile.targetMarket?.segments ?? []).includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleMulti("segments", s)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            selected
                              ? "border-cyan-400 bg-cyan-400 text-black"
                              : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  <Input
                    value={customSegment}
                    onChange={(e: any) => setCustomSegment(e.target.value)}
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustom("segments", customSegment);
                        setCustomSegment("");
                      }
                    }}
                    placeholder="Add custom segment and press Enter"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Target locations / countries</Label>
                  <CountrySelect
                    selected={profile.targetMarket?.locations ?? []}
                    onSelect={(country) => addCustom("locations", country)}
                    placeholder="Select any country"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(profile.targetMarket?.locations ?? []).map((s: string) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleMulti("locations", s)}
                        className="rounded-full border border-cyan-400 bg-cyan-400 px-3 py-1 text-xs font-medium text-black"
                        title="Remove"
                      >
                        {s} ×
                      </button>
                    ))}
                    {(profile.targetMarket?.locations ?? []).length === 0 && (
                      <p className="text-xs text-white/40">No countries selected yet.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Ideal customer profile notes</Label>
                  <Textarea
                    value={profile.targetMarket?.notes ?? ""}
                    onChange={(e: any) => update({ targetMarket: { ...(profile.targetMarket ?? {}), notes: e.target.value } })}
                    placeholder="Decision makers, company size, pain points…"
                    rows={3}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Properties (key → value)</Label>
                  {(profile.properties ?? []).map((p: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <Input placeholder="Key" value={p.key} onChange={(e: any) => { const n = [...(profile.properties ?? [])]; n[i] = { ...n[i], key: e.target.value }; update({ properties: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                      <Input placeholder="Value" value={p.value} onChange={(e: any) => { const n = [...(profile.properties ?? [])]; n[i] = { ...n[i], value: e.target.value }; update({ properties: n }); }} className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => update({ properties: [...(profile.properties ?? []), { key: "", value: "" }] })}>
                    + Add property
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label className="text-white/80">Operating mode</Label>
                  <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0b1024] text-white">
                      <SelectItem value="FULLY_AI_AUTOMATED" className="text-white focus:bg-white/10 focus:text-white">Fully AI automated</SelectItem>
                      <SelectItem value="AI_WITH_APPROVAL" className="text-white focus:bg-white/10 focus:text-white">AI + human approval</SelectItem>
                      <SelectItem value="FULLY_MANUAL" className="text-white focus:bg-white/10 focus:text-white">Fully manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-white/40">
                    {mode === "FULLY_AI_AUTOMATED"
                      ? "AI drafts and sends without approval."
                      : mode === "AI_WITH_APPROVAL"
                        ? "AI drafts; humans approve before sending."
                        : "AI disabled; everything manual."}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">Manual takeover (pause AI)</p>
                    <p className="text-xs text-white/40">{paused ? "AI is paused." : "AI is active."}</p>
                  </div>
                  <Switch checked={paused} onCheckedChange={setPaused} />
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                  You can configure AI providers, models and usage limits later in <span className="text-cyan-400">AI Management</span> and <span className="text-cyan-400">Settings</span>.
                </div>
              </>
            )}

            {step === 4 && (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
                  <Rocket className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">You're all set!</h3>
                <p className="text-sm text-white/60">
                  Your company profile, products, target customers and AI mode are configured. The AI can now
                  research, qualify, match and draft outreach. You can refine everything later from the dashboard.
                </p>
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/40">Industry</p>
                    <p className="text-sm font-medium text-white">{formatIndustry(profile.industry)}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/40">Products / Services</p>
                    <p className="text-sm font-medium text-white">
                      {(profile.products ?? []).length + (profile.services ?? []).length}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/40">Target segments</p>
                    <p className="text-sm font-medium text-white">
                      {(profile.targetMarket?.segments ?? []).length || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-white/40">AI mode</p>
                    <p className="text-sm font-medium text-white">{mode.replace(/_/g, " ")}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-white"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || saving}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={next} disabled={saving} className="bg-gradient-to-r from-indigo-500 to-cyan-400 text-white">
                  {saving ? "Saving…" : "Next"} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={finish} disabled={saving} className="bg-gradient-to-r from-indigo-500 to-cyan-400 text-white">
                  {saving ? "Finishing…" : "Open Dashboard"} <Rocket className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
            {step < STEPS.length - 1 && (
              <div className="text-center">
                <button
                  className="text-xs text-white/40 hover:text-white/70"
                  onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
                >
                  Skip this step
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

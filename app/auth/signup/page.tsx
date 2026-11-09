"use client";

import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/link";
import { useRef, useState } from "react";
import { Mail, Lock, User, AlertCircle, Building2, ArrowLeft, Bot, Eye, EyeOff, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiBackground } from "@/components/ai-background";

const INDUSTRIES = [
  { value: "software_it", label: "Software & IT (ERP, CRM, SaaS, AI)" },
  { value: "real_estate", label: "Real Estate (buy/sell/rent property)" },
  { value: "retail_wholesale", label: "Retail & Wholesale (products)" },
  { value: "education", label: "Education (school/college/coaching)" },
  { value: "healthcare", label: "Healthcare (clinic/diagnostics)" },
  { value: "travel_hospitality", label: "Travel & Hospitality" },
  { value: "finance_insurance", label: "Finance & Insurance" },
  { value: "professional_services", label: "Professional Services (marketing, consulting, legal)" },
  { value: "manufacturing_b2b", label: "Manufacturing & B2B" },
  { value: "custom", label: "Other / Custom" },
];

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2, "Company name is required"),
  industry: z.string().min(1, "Please select your company type"),
});

type SignUpForm = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { industry: "" },
  });

  const onSubmit = async (data: SignUpForm) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setIsLoading(true);
    try {
      const industryLabel =
        INDUSTRIES.find((i) => i.value === data.industry)?.label ?? data.industry;
      const payload = { ...data, industry: industryLabel };
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setError(
          errorData?.error?.message ||
            errorData?.message ||
            "Something went wrong. Please try again."
        );
        submittingRef.current = false;
        setIsLoading(false);
        return;
      }

      const result = await response.json().catch(() => ({}));
      if (result.needsVerification) {
        const params = new URLSearchParams({ email: result.email });
        if (result.devCode) params.set("code", result.devCode);
        window.location.href = `/auth/verify-email?${params.toString()}`;
        return;
      }

      window.location.href = "/auth/signin?message=account-created";
    } catch {
      setError("Something went wrong. Please try again.");
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const fieldClass = (hasError?: boolean) =>
    `border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-cyan-400 ${
      hasError ? "border-red-500/50" : ""
    }`;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] px-4 py-10">
      <AiBackground />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30 animate-pulse-glow">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">Create account</h2>
            <p className="mt-2 text-sm text-white/60">Set up your company workspace</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              AI agent live
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/80">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                {...register("name")}
                className={fieldClass(!!errors.name)}
              />
              {errors.name && <p className="text-xs text-red-300">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                {...register("email")}
                className={fieldClass(!!errors.email)}
              />
              {errors.email && <p className="text-xs text-red-300">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-white/80">Company name</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Acme Corp"
                {...register("companyName")}
                className={fieldClass(!!errors.companyName)}
              />
              {errors.companyName && (
                <p className="text-xs text-red-300">{errors.companyName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry" className="text-white/80">Company type / industry</Label>
              <Controller
                name="industry"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="industry"
                      className={`border-white/10 bg-white/5 text-white focus-visible:ring-cyan-400 ${
                        errors.industry ? "border-red-500/50" : ""
                      }`}
                    >
                      <SelectValue placeholder="Select your company type" />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0b1024] text-white">
                      {INDUSTRIES.map((ind) => (
                        <SelectItem
                          key={ind.value}
                          value={ind.value}
                          className="text-white focus:bg-white/10 focus:text-white"
                        >
                          {ind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.industry && (
                <p className="text-xs text-red-300">{errors.industry.message}</p>
              )}
              <p className="text-xs text-white/40">
                The AI uses this to know what kind of potential customers to search for.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  {...register("password")}
                  className={fieldClass(!!errors.password) + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-300">{errors.password.message}</p>
              )}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-indigo-500 to-cyan-400 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02]"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>

            <p className="text-center text-sm text-white/60">
              Already have an account?{" "}
              <Link href="/auth/signin" className="font-medium text-cyan-400 hover:text-cyan-300">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

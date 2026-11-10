"use client";

import { signIn } from "next-auth/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/link";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Lock, AlertCircle, ArrowLeft, Sparkles, Bot, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { AiBackground } from "@/components/ai-background";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInForm = z.infer<typeof signInSchema>;

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050816]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInForm) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        submittingRef.current = false;
        setIsLoading(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl");

      // Decide landing page based on the user's company info (first-time companies → onboarding)
      let target = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
      try {
        const profileRes = await fetch("/api/v1/company-profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData && profileData.onboardingCompleted === false && !profileData.isSuperAdmin) {
            target = "/onboarding";
          }
        }
      } catch {
        /* keep default */
      }

      // Check if user belongs to multiple workspaces
      try {
        const res = await fetch("/api/v1/workspaces");
        if (res.ok) {
          const data = await res.json();
          const list = data.data ?? [];
          if (list.length > 1) {
            const finalTarget = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
            window.location.href = `/auth/select-workspace?callbackUrl=${encodeURIComponent(finalTarget)}`;
            return;
          }
        }
      } catch {
        /* fall through to default */
      }

      window.location.href = target;
    } catch {
      setError("Something went wrong. Please try again.");
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] px-4">
      <AiBackground />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30 animate-pulse-glow">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-white/60">Access your AI Lead Generation workspace</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              AI agent live
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {(message === "verified" || message === "account-created") && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  {message === "verified"
                    ? "Email verified successfully. You can now sign in."
                    : "Account created. Please verify your email, then sign in."}
                </span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                {...register("email")}
                className={`border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-cyan-400 ${
                  errors.email ? "border-red-500/50" : ""
                }`}
              />
              {errors.email && <p className="text-xs text-red-300">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  {...register("password")}
                  className={`border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-cyan-400 pr-10 ${
                    errors.password ? "border-red-500/50" : ""
                  }`}
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
              {errors.password && <p className="text-xs text-red-300">{errors.password.message}</p>}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-indigo-500 to-cyan-400 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02]"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <p className="text-center text-sm text-white/60">
              Don't have an account?{" "}
              <Link href="/auth/signup" className="font-medium text-cyan-400 hover:text-cyan-300">
                Sign up
              </Link>
            </p>
          </form>
        </div>

      </div>
    </div>
  );
}

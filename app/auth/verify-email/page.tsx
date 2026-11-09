"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/link";
import { AlertCircle, CheckCircle2, Mail, ArrowLeft, Bot, Loader2 } from "lucide-react";
import { AiBackground } from "@/components/ai-background";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email") ?? "";
  const codeParam = searchParams.get("code") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState(codeParam);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
    if (codeParam) setCode(codeParam);
  }, [emailParam, codeParam]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Verification failed");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.replace("/auth/signin?message=verified"), 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">Verify your email</h2>
            <p className="mt-2 text-sm text-white/60">
              Enter the verification code to activate your account
            </p>
            {codeParam && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Demo mode: your code is <span className="font-mono font-bold">{codeParam}</span>
              </div>
            )}
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-white">Email verified! Redirecting to sign in…</p>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={verify}>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-cyan-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code" className="text-white/80">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  maxLength={10}
                  className="border-white/10 bg-white/5 text-center text-lg tracking-widest text-white placeholder:text-white/40 focus-visible:ring-cyan-400"
                />
              </div>
              <Button
                className="w-full bg-gradient-to-r from-indigo-500 to-cyan-400 font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform hover:scale-[1.02]"
                type="submit"
                disabled={loading || !email || !code}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify email"
                )}
              </Button>
              <p className="text-center text-sm text-white/60">
                Already verified?{" "}
                <Link href="/auth/signin" className="font-medium text-cyan-400 hover:text-cyan-300">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050816]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}

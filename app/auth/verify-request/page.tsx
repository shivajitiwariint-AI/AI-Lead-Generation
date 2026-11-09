import { Link } from "@/components/link";

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mx-auto mb-4">
          <svg className="h-8 w-8 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h2 className="text-2xl font-semibold">Check your email</h2>
        <p className="mt-2 text-muted-foreground">
          We've sent a verification link to your inbox. Click it to verify your
          email address.
        </p>
        <div className="mt-8">
          <Link href="/auth/signin" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

import { Link } from "@/components/link";

export default function NewUserPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent mx-auto mb-4">
          <svg className="h-8 w-8 text-accent-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h2 className="text-2xl font-semibold">Welcome!</h2>
        <p className="mt-2 text-muted-foreground">
          Your account has been created. Please set up your company workspace.
        </p>
        <div className="mt-8">
          <Link href="/dashboard" className="text-primary font-medium hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

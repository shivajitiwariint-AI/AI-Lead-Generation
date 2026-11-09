import { Link } from "@/components/link";

export default function ErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive mx-auto mb-4">
          <svg className="h-8 w-8 text-destructive-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="mt-2 text-muted-foreground">
          There was an error authenticating. Please try again.
        </p>
        <div className="mt-8">
          <Link href="/auth/signin" className="text-primary font-medium hover:underline">
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}

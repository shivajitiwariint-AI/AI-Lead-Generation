import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold tracking-tight">404</p>
        <h1 className="mt-4 text-xl font-semibold">This page could not be found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you opened does not exist or was moved. Check the link, or go back to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/leads">Go to leads</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

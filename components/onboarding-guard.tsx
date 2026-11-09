"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Redirects authenticated users whose onboarding isn't complete to /onboarding.
 * Skips the redirect when already on /onboarding (or public/auth routes).
 */
export function OnboardingGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!pathname || pathname === "/onboarding" || pathname.startsWith("/auth") || pathname.startsWith("/api")) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/company-profile");
        if (!res.ok) { setChecked(true); return; }
        const data = await res.json();
        if (!cancelled && data && data.onboardingCompleted === false && !data.isSuperAdmin) {
          router.replace("/onboarding");
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname, router]);

  return null;
}

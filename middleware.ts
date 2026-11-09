import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const apiHits = new Map<string, number[]>();
function apiRateLimited(key: string) {
  const now = Date.now();
  const arr = (apiHits.get(key) ?? []).filter((t) => now - t < 60 * 1000);
  arr.push(now);
  apiHits.set(key, arr);
  if (apiHits.size > 10000) apiHits.clear();
  return arr.length > 120;
}
function secure(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.headers.delete("X-Powered-By");
  return res;
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Public paths that don't require auth
    const publicPaths = [
      "/",
      "/auth/signin",
      "/auth/signup",
      "/auth/error",
      "/auth/verify-request",
      "/auth/new-user",
      "/api/health",
      "/api/webhooks",
      "/api/v1/public",
    ];

    const isPublic = (p: string, path: string) =>
      p === "/" ? path === "/" : path.startsWith(p);

    if (publicPaths.some((p) => isPublic(p, pathname))) {
      return secure(NextResponse.next());
    }

    // API routes require token (session JWT), rate-limited
    if (pathname.startsWith("/api/")) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      if (apiRateLimited(ip)) {
        return secure(
          new NextResponse(JSON.stringify({ error: { code: "RATE_LIMIT", message: "Too many requests" } }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (!token) {
        return secure(
          new NextResponse(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return secure(NextResponse.next());
    }

    // Dashboard and app routes require auth
    if (!token) {
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return secure(NextResponse.redirect(signInUrl));
    }

    return secure(NextResponse.next());
  },
  {
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    pages: {
      signIn: "/auth/signin",
      error: "/auth/error",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const publicPaths = [
          "/",
          "/auth/signin",
          "/auth/signup",
          "/auth/error",
          "/auth/verify-request",
          "/auth/new-user",
          "/api/health",
          "/api/webhooks",
          "/api/v1/public",
        ];
        if (
          publicPaths.some((p) =>
            p === "/" ? pathname === "/" : pathname.startsWith(p)
          )
        )
          return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/leads",
    "/leads/:path*",
    "/pipeline",
    "/pipeline/:path*",
    "/conversations",
    "/conversations/:path*",
    "/meetings",
    "/meetings/:path*",
    "/chatbots",
    "/chatbots/:path*",
    "/knowledge-base",
    "/knowledge-base/:path*",
    "/campaigns",
    "/campaigns/:path*",
    "/follow-ups",
    "/follow-ups/:path*",
    "/integrations",
    "/integrations/:path*",
    "/team",
    "/team/:path*",
    "/reports",
    "/reports/:path*",
    "/settings",
    "/settings/:path*",
    "/profile",
    "/profile/:path*",
    "/research",
    "/research/:path*",
    "/emails",
    "/emails/:path*",
    "/activity",
    "/activity/:path*",
    "/company",
    "/company/:path*",
    "/jobs",
    "/jobs/:path*",
    "/scoring-profiles",
    "/scoring-profiles/:path*",
    "/audit-logs",
    "/audit-logs/:path*",
    "/ai-providers",
    "/ai-providers/:path*",
    "/ai-models",
    "/ai-models/:path*",
    "/ai-assignments",
    "/ai-assignments/:path*",
    "/ai-usage",
    "/ai-usage/:path*",
    "/admin/:path*",
    "/logout",
    "/logout/:path*",
    "/api/:path*",
  ],
};

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/activity";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
    newUser: "/auth/new-user",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const email = credentials.email.toLowerCase().trim();

        // Login rate limiting (security requirement)
        const rl = checkRateLimit(`login:${email}`);
        if (!rl.allowed) {
          const minutes = Math.ceil((rl.resetAt - Date.now()) / 60000);
          throw new Error(`Too many attempts. Try again in ${minutes} minute(s).`);
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          recordFailure(`login:${email}`);
          await recordAudit({
            tenantId: null,
            actorId: null,
            actorType: "user",
            action: "auth.login_failed",
            category: "auth",
            targetType: "user",
            targetId: user?.id ?? null,
            metadata: { email, reason: "user_not_found" },
          });
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          recordFailure(`login:${email}`);
          await recordAudit({
            tenantId: null,
            actorId: user.id,
            actorType: "user",
            action: "auth.login_failed",
            category: "auth",
            targetType: "user",
            targetId: user.id,
            metadata: { email, reason: "bad_password" },
          });
          throw new Error("Invalid credentials");
        }

        if (user.status === "SUSPENDED") {
          await recordAudit({
            tenantId: null,
            actorId: user.id,
            actorType: "user",
            action: "auth.login_blocked",
            category: "auth",
            targetType: "user",
            targetId: user.id,
            metadata: { email, reason: "suspended" },
          });
          throw new Error("Account is suspended");
        }

        if (user.status === "PENDING_VERIFICATION") {
          throw new Error("Please verify your email before signing in");
        }

        if (user.status === "INACTIVE") {
          throw new Error("Account is inactive");
        }

        // Success
        recordSuccess(`login:${email}`);
        await recordAudit({
          tenantId: null,
          actorId: user.id,
          actorType: "user",
          action: "auth.login_success",
          category: "auth",
          targetType: "user",
          targetId: user.id,
          metadata: { email },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          status: user.status,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
        token.status = (user as any).status;
        // Default tenant: first active membership
        const memberships = await prisma.tenantUser.findMany({
          where: { userId: user.id, status: "ACTIVE" },
          select: { tenantId: true },
          orderBy: { createdAt: "asc" },
        });
        if (memberships.length > 0 && !token.tenantId) {
          token.tenantId = memberships[0].tenantId;
        }
      }
      // Allow client to switch workspace via useSession().update({tenantId})
      if (trigger === "update" && session?.tenantId) {
        const membership = await prisma.tenantUser.findFirst({
          where: { userId: token.id as string, tenantId: session.tenantId, status: "ACTIVE" },
        });
        if (membership) token.tenantId = session.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).email = token.email;
        (session.user as any).status = token.status;
        (session.user as any).tenantId = token.tenantId ?? null;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.callback-url"
          : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-next-auth.csrf-token"
          : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

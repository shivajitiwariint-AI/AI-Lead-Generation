export const dynamic = "force-dynamic";

import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, ShieldCheck, Building2, KeyRound, CheckCircle2 } from "lucide-react";

export default async function ProfilePage() {
  const ctx = await getAuthContext();

  const membership =
    ctx.tenantId && ctx.userId
      ? await prisma.tenantUser.findFirst({
          where: { tenantId: ctx.tenantId, userId: ctx.userId },
        })
      : null;

  const [tenant, role, membershipCount] = await Promise.all([
    ctx.tenantId
      ? prisma.tenant.findUnique({ where: { id: ctx.tenantId } })
      : Promise.resolve(null),
    membership
      ? prisma.role.findUnique({ where: { id: membership.roleId } })
      : Promise.resolve(null),
    ctx.tenantId
      ? prisma.tenantUser.count({ where: { tenantId: ctx.tenantId, status: "ACTIVE" } })
      : Promise.resolve(0),
  ]);

  const initials = (ctx.userEmail || "A")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Your account details and workspace access.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-semibold">
              {initials}
            </div>
            <CardTitle className="mt-2 break-all">{ctx.userEmail}</CardTitle>
            <CardDescription>
              {role?.name ?? ctx.role ?? "Member"} · {tenant?.name ?? "Personal workspace"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> Email status
              </span>
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald" />
                Verified
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Account
              </span>
              <Badge variant="outline">{ctx.userStatus || "ACTIVE"}</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>Company you are currently signed in to</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company" value={tenant?.name ?? "—"} />
              <InfoRow icon={<KeyRound className="h-4 w-4" />} label="Workspace slug" value={tenant?.slug ?? "—"} />
              <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Your role" value={role?.name ?? ctx.role ?? "—"} />
              <InfoRow
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Active teammates"
                value={String(membershipCount)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Session and access information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-muted-foreground">Session strategy</span>
                <span className="font-medium">JWT · 30 days</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-muted-foreground">Cross-tenant access</span>
                <span className="font-medium">{ctx.isSuperAdmin ? "Enabled" : "Restricted"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-muted-foreground">Permissions granted</span>
                <span className="font-medium">{ctx.permissions.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
      <span className="text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

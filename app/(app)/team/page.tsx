export const dynamic = "force-dynamic";

import { getAuthContext } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, ShieldCheck, Building2, Sparkles } from "lucide-react";
import { InviteMember } from "@/components/invite-member";

export default async function TeamPage() {
  const ctx = await getAuthContext();

  const tenant = ctx.tenantId
    ? await prisma.tenant.findUnique({ where: { id: ctx.tenantId } })
    : null;
  const isWorkspaceView = !!tenant && tenant.slug !== "platform";

  const tenants = await prisma.tenant.findMany({
    where: { slug: { not: "platform" } },
    orderBy: { createdAt: "asc" },
  });

  const memberships = await prisma.tenantUser.findMany({ orderBy: { createdAt: "asc" } });
  const userIds = Array.from(new Set(memberships.map((m) => m.userId)));
  const roleIds = Array.from(new Set(memberships.map((m) => m.roleId)));

  const [users, roles] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } } }) : Promise.resolve([]),
    roleIds.length ? prisma.role.findMany({ where: { id: { in: roleIds } } }) : Promise.resolve([]),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const roleById = new Map(roles.map((r) => [r.id, r]));

  // Show only invited members: exclude the company owner(s) (creators), keep invited roles
  const invited = memberships.filter((m) => roleById.get(m.roleId)?.type !== "COMPANY_OWNER");

  const emailOf = (m: (typeof invited)[number]) =>
    (userById.get(m.userId)?.email ?? m.userId).toLowerCase();

  const totalUnique = new Set(invited.map(emailOf)).size;
  const active = new Set(invited.filter((m) => m.status === "ACTIVE").map(emailOf)).size;

  const byTenant = new Map<string, typeof invited>();
  for (const m of invited) {
    const list = byTenant.get(m.tenantId) ?? [];
    list.push(m);
    byTenant.set(m.tenantId, list);
  }
  const visibleTenants = tenants.filter((t) => (byTenant.get(t.id)?.length ?? 0) > 0);
  const companiesWithInvited = visibleTenants.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Invited members across the platform. Owners are hidden.</p>
        </div>
        {isWorkspaceView && <InviteMember workspaceName={tenant?.name ?? "this workspace"} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Invited members" value={totalUnique} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active" value={active} icon={<ShieldCheck className="h-4 w-4" />} />
        <StatCard label="Companies" value={companiesWithInvited} icon={<Building2 className="h-4 w-4" />} />
      </div>

      {visibleTenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No invited members yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Team members appear here only when they are invited. Invite your teammates with the button above.
            </p>
          </CardContent>
        </Card>
      ) : (
        visibleTenants.map((t) => {
          const ms = byTenant.get(t.id) ?? [];
          return (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription>
                      {t.slug} · {ms.length} invited member{ms.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={t.status === "ACTIVE" ? "default" : "outline"}>{t.status}</Badge>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {ms.map((m) => {
                    const user = userById.get(m.userId);
                    const role = roleById.get(m.roleId);
                    return (
                      <MemberRow
                        key={m.id}
                        name={user?.name || user?.email?.split("@")[0] || "Unknown user"}
                        email={user?.email ?? "—"}
                        role={role?.name ?? "Member"}
                        status={m.status}
                      />
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberRow({
  name,
  email,
  role,
  status,
}: {
  name: string;
  email: string;
  role: string;
  status: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-4 py-4">
      <Avatar>
        <AvatarFallback className="bg-primary/10 text-primary">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{email}</p>
      </div>
      <Badge variant="secondary">{role}</Badge>
      <Badge variant={status === "ACTIVE" ? "default" : "outline"}>{status}</Badge>
    </li>
  );
}

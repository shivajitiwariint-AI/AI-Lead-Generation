import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type UserRole =
  | "SUPER_ADMIN"
  | "COMPANY_OWNER"
  | "COMPANY_ADMIN"
  | "SALES_MANAGER"
  | "SALES_REPRESENTATIVE"
  | "READ_ONLY_ANALYST";

export interface AuthContext {
  userId: string;
  userEmail: string;
  userStatus: string;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantStatus: string | null;
  enabledModules: string[] | null;
  role: UserRole | null;
  roleType: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
}

export async function getAuthContext(): Promise<AuthContext> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      userId: "",
      userEmail: "",
      userStatus: "",
      tenantId: null,
      tenantSlug: null,
      tenantStatus: null,
      enabledModules: null,
      role: null,
      roleType: null,
      permissions: [],
      isSuperAdmin: false,
      isAuthenticated: false,
    };
  }

  const userId = (session.user as any).id as string;
  const userEmail = session.user.email as string;

  // Find the user's tenant memberships
  const tenantUsers = await prisma.tenantUser.findMany({
    where: { userId },
  });

  if (tenantUsers.length === 0) {
    return {
      userId,
      userEmail,
      userStatus: (session.user as any).status as string,
      tenantId: null,
      tenantSlug: null,
      tenantStatus: null,
      enabledModules: null,
      role: null,
      roleType: null,
      permissions: [],
      isSuperAdmin: false,
      isAuthenticated: true,
    };
  }

  // Fetch tenant, role, and permissions separately
  const firstMembership = tenantUsers[0];

  const tenant = await prisma.tenant.findUnique({
    where: { id: firstMembership.tenantId },
  });

  const role = await prisma.role.findUnique({
    where: { id: firstMembership.roleId },
  });

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: firstMembership.roleId },
  });

  const permissionIds = rolePermissions.map((rp) => rp.permissionId);
  const permissions =
    permissionIds.length > 0
      ? await prisma.permission.findMany({
          where: { id: { in: permissionIds } },
          select: { key: true },
        })
      : [];

  const roleType = (role?.type as UserRole) ?? null;

  return {
    userId,
    userEmail,
    userStatus: (session.user as any).status as string,
    tenantId: firstMembership.tenantId,
    tenantSlug: tenant?.slug ?? null,
    tenantStatus: tenant?.status ?? null,
    enabledModules: (tenant?.enabledModules as string[] | null) ?? null,
    role: roleType,
    roleType: role?.name ?? null,
    permissions: permissions.map((p) => p.key),
    isSuperAdmin: roleType === "SUPER_ADMIN",
    isAuthenticated: true,
  };
}

export async function getCurrentTenantId(): Promise<string | null> {
  const ctx = await getAuthContext();
  return ctx.tenantId;
}

export async function requireAuth() {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    throw new Error("Unauthenticated");
  }
  return ctx;
}

export async function requireTenant() {
  const ctx = await requireAuth();
  if (!ctx.tenantId) {
    throw new Error("No tenant context");
  }
  return ctx;
}

export async function requirePermission(permissionKey: string) {
  const ctx = await requireAuth();
  if (!ctx.permissions.includes(permissionKey) && !ctx.isSuperAdmin) {
    throw new Error(`Forbidden: missing permission "${permissionKey}"`);
  }
  return ctx;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const ctx = await requireAuth();
  if (!ctx.role || !allowedRoles.includes(ctx.role)) {
    throw new Error("Forbidden: insufficient role");
  }
  return ctx;
}

export async function requireSuperAdmin() {
  return requireRole(["SUPER_ADMIN"]);
}

export async function assertTenantAccess(tenantId: string) {
  const ctx = await requireAuth();
  if (!ctx.isSuperAdmin && ctx.tenantId !== tenantId) {
    throw new Error("Forbidden: cross-tenant access denied");
  }
  return ctx;
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const tenantUsers = await prisma.tenantUser.findMany({
    where: { userId },
  });

  const permissionIds = new Set<string>();
  for (const tu of tenantUsers) {
    const rps = await prisma.rolePermission.findMany({
      where: { roleId: tu.roleId },
      select: { permissionId: true },
    });
    for (const rp of rps) {
      permissionIds.add(rp.permissionId);
    }
  }

  if (permissionIds.size === 0) return [];

  const perms = await prisma.permission.findMany({
    where: { id: { in: Array.from(permissionIds) } },
    select: { key: true },
  });
  return perms.map((p) => p.key);
}

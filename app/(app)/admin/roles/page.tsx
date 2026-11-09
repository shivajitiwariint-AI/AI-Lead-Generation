"use client";

import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";

interface Perm {
  id: string;
  key: string;
  description?: string | null;
}
interface Role {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  permissionIds: string[];
}

function RolesContent() {
  const [perms, setPerms] = useState<Perm[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/roles");
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json();
      setPerms(Array.isArray(d.permissions) ? d.permissions : []);
      const list: Role[] = Array.isArray(d.roles) ? d.roles : [];
      setRoles(list);
      setDraft(Object.fromEntries(list.map((r) => [r.id, new Set(r.permissionIds)])));
    } catch (e: any) {
      toast.error(e.message || "Could not load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (roleId: string, permId: string) => {
    setDraft((prev) => {
      const next = new Set(prev[roleId] ?? new Set());
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return { ...prev, [roleId]: next };
    });
  };

  const save = async (role: Role) => {
    setSaving(role.id);
    try {
      const res = await fetch(`/api/v1/admin/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: Array.from(draft[role.id] ?? new Set()) }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      toast.success(`${role.name} updated`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {roles.map((role) => {
        const locked = role.type === "SUPER_ADMIN" || role.type === "COMPANY_OWNER";
        return (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> {role.name}
                </CardTitle>
                <CardDescription>{role.description ?? role.type}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {locked && <Badge variant="secondary">Full access</Badge>}
                {!locked && (
                  <Button size="sm" onClick={() => save(role)} disabled={saving === role.id} title={`Save permissions for ${role.name}`}>
                    {saving === role.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                    {saving === role.id ? "Saving…" : "Save"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {perms.map((p) => {
                  const checked = draft[role.id]?.has(p.id) ?? false;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${locked ? "opacity-60" : ""}`}
                      title={locked ? "Full access — cannot be edited" : p.description ?? p.key}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => !locked && toggle(role.id, p.id)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block truncate font-mono text-xs">{p.key}</span>
                        {p.description && <span className="block text-xs text-muted-foreground">{p.description}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {roles.length === 0 && <p className="text-sm text-muted-foreground">No roles found.</p>}
    </div>
  );
}

export default function AdminRolesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
          <p className="text-muted-foreground">
            Which features each role can use. Super Admin and Company Owner always have full access. Changes apply to every company using that role immediately.
          </p>
        </div>
        <RolesContent />
      </div>
    </Suspense>
  );
}

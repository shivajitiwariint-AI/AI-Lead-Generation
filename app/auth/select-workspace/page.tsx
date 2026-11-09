"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Workspace { tenantId: string; name: string; slug: string; status: string }

export default function SelectWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/workspaces");
        if (res.ok) {
          const d = await res.json();
          const list: Workspace[] = d.data ?? [];
          setWorkspaces(list);
          setSelected(d.current ?? list[0]?.tenantId ?? null);
          // If only one workspace, auto-select and continue
          if (list.length <= 1 && list[0]) {
            await choose(list[0].tenantId, true);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const choose = async (tenantId: string, auto = false) => {
    setSaving(true);
    try {
      await update({ tenantId });
      const cb = searchParams.get("callbackUrl");
      const target = cb && cb.startsWith("/") ? cb : "/dashboard";
      if (!auto) toast.success("Workspace selected");
      router.replace(target);
    } catch {
      toast.error("Could not switch workspace");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[120px] animate-float" />
      </div>
      <div className="relative w-full max-w-lg animate-fade-up">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-white">Select your workspace</CardTitle>
            <CardDescription className="text-white/60">
              You belong to multiple companies. Choose which one to work in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspaces.map((w) => (
              <button
                key={w.tenantId}
                onClick={() => setSelected(w.tenantId)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                  selected === w.tenantId
                    ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]"
                }`}
              >
                <div>
                  <p className="font-medium text-white">{w.name}</p>
                  <p className="text-xs text-white/50">{w.slug} · {w.status}</p>
                </div>
                {selected === w.tenantId && <Check className="h-5 w-5 text-cyan-400" />}
              </button>
            ))}
            <Button
              className="w-full bg-gradient-to-r from-indigo-500 to-cyan-400 font-semibold text-white"
              onClick={() => selected && choose(selected)}
              disabled={!selected || saving}
            >
              {saving ? "Switching…" : "Continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

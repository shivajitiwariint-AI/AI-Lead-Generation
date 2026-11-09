"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function InviteMember({ workspaceName }: { workspaceName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SALES_REPRESENTATIVE");
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error?.message || "Invite failed");
      toast.success(d.message ? d.message : "Member invited");
      setTempPassword(d.tempPassword ?? null);
      setName("");
      setEmail("");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Invite failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Invite member
      </Button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Invite member</p>
          <p className="text-xs text-muted-foreground">Add someone to {workspaceName}</p>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {tempPassword ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Member created. Share this temporary password with them; they should change it after first sign-in.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2">
            <code className="flex-1 select-all text-xs">{tempPassword}</code>
            <button
              className="rounded-md p-1.5 hover:bg-accent"
              onClick={() => {
                navigator.clipboard?.writeText(tempPassword);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              aria-label="Copy password"
            >
              {copied ? <Check className="h-4 w-4 text-emerald" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => { setTempPassword(null); setOpen(false); }}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Full name</Label>
            <Input id="inv-name" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} placeholder="jane@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALES_REPRESENTATIVE">Sales Representative</SelectItem>
                <SelectItem value="SALES_MANAGER">Sales Manager</SelectItem>
                <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
                <SelectItem value="READ_ONLY_ANALYST">Read-only Analyst</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Inviting…" : "Send invite"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

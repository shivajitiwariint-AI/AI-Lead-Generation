"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  DollarSign,
  Activity,
  RefreshCw,
  Filter,
  TrendingUp,
  Terminal,
  Save,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCost: number;
  totalRequests: number;
}

interface UsageLog {
  id: string;
  provider: { providerKey: string; displayName: string };
  model: { modelKey: string; displayName: string };
  inputTokens: number;
  outputTokens: number;
  requestId?: string | null;
  createdAt: string;
}

interface CostLog {
  id: string;
  providerId: string;
  modelId: string;
  estimatedCost: number;
  currency: string;
  createdAt: string;
}

export default function AIUsagePage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [usage, setUsage] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("30d");
  const [budget, setBudget] = useState<any>(null);
  const [budgetForm, setBudgetForm] = useState({ monthlyTokenLimit: "", monthlyCostLimit: "", alertThreshold: "0.8", enforce: false });
  const [savingBudget, setSavingBudget] = useState(false);
  const [scope, setScope] = useState<"platform" | string>("platform");

  const loadBudget = useCallback(async (tenantId?: string) => {
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
      const res = await fetch(`/api/v1/admin/ai/budgets${qs}`);
      if (!res.ok) return;
      const d = await res.json();
      const row = Array.isArray(d.budgets) ? d.budgets.find((b: any) => b.tenantId === (tenantId ?? null)) ?? d.budgets[0] : null;
      setBudget(row ?? d.status ?? null);
      if (row) {
        setBudgetForm({
          monthlyTokenLimit: row.monthlyTokenLimit != null ? String(row.monthlyTokenLimit) : "",
          monthlyCostLimit: row.monthlyCostLimit != null ? String(row.monthlyCostLimit) : "",
          alertThreshold: String(row.alertThreshold ?? 0.8),
          enforce: !!row.enforce,
        });
      } else if (d.status) {
        setBudgetForm({
          monthlyTokenLimit: d.status.tokenLimit != null ? String(d.status.tokenLimit) : "",
          monthlyCostLimit: d.status.budgetLimit != null ? String(d.status.budgetLimit) : "",
          alertThreshold: String(d.status.alertThreshold ?? 0.8),
          enforce: !!d.status.enforce,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const saveBudget = async () => {
    setSavingBudget(true);
    try {
      const res = await fetch("/api/v1/admin/ai/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: scope === "platform" ? undefined : scope,
          monthlyTokenLimit: budgetForm.monthlyTokenLimit ? Number(budgetForm.monthlyTokenLimit) : null,
          monthlyCostLimit: budgetForm.monthlyCostLimit ? Number(budgetForm.monthlyCostLimit) : null,
          alertThreshold: Number(budgetForm.alertThreshold) || 0.8,
          enforce: budgetForm.enforce,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      toast.success("Usage limits saved");
      loadBudget(scope === "platform" ? undefined : scope);
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSavingBudget(false);
    }
  };

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const now = new Date();
      let start = new Date();
      if (selectedPeriod === "7d") start.setDate(now.getDate() - 7);
      else if (selectedPeriod === "30d") start.setDate(now.getDate() - 30);
      else if (selectedPeriod === "90d") start.setMonth(now.getMonth() - 3);

      params.set("startDate", start.toISOString());
      params.set("endDate", now.toISOString());

      const res = await fetch(
        `/api/v1/admin/ai/usage?${params.toString()}`,
        { headers: { "X-Tenant-Id": "demo-tenant-id" } }
      );

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary ?? null);
        setUsage(Array.isArray(data.usage) ? data.usage : []);
      }
    } catch {
      setSummary(null);
      setUsage([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    loadBudget(scope === "platform" ? undefined : scope);
  }, [scope]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AI Usage & Costs</h1>
          <p className="text-muted-foreground">
            Monitor token usage, estimated costs, and provider health.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Period:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPeriod("7d")}
              className={cn(
                "px-3",
                selectedPeriod === "7d" ? "bg-primary text-primary-foreground" : ""
              )}
            >
              7d
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPeriod("30d")}
              className={cn(
                "px-3",
                selectedPeriod === "30d" ? "bg-primary text-primary-foreground" : ""
              )}
            >
              30d
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPeriod("90d")}
              className={cn(
                "px-3",
                selectedPeriod === "90d" ? "bg-primary text-primary-foreground" : ""
              )}
            >
              90d
            </Button>
          </div>
          <Button variant="outline" onClick={fetchUsage}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Usage limits
          </CardTitle>
          <CardDescription>
            Monthly token/cost caps. When <strong>Enforce</strong> is on, AI calls fail fast once the limit is hit (no extra spend).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Scope</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                title="Limit applies to"
              >
                <option value="platform">Platform (default)</option>
                <option value="b85fcf2b-4820-48ed-b6b3-06c0b29a0d76">IBM (company)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monthly tokens</Label>
              <Input value={budgetForm.monthlyTokenLimit} onChange={(e) => setBudgetForm({ ...budgetForm, monthlyTokenLimit: e.target.value })} placeholder="1000000" className="w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monthly cost ($)</Label>
              <Input value={budgetForm.monthlyCostLimit} onChange={(e) => setBudgetForm({ ...budgetForm, monthlyCostLimit: e.target.value })} placeholder="50" className="w-32" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alert at (0–1)</Label>
              <Input value={budgetForm.alertThreshold} onChange={(e) => setBudgetForm({ ...budgetForm, alertThreshold: e.target.value })} placeholder="0.8" className="w-24" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" checked={budgetForm.enforce} onChange={(e) => setBudgetForm({ ...budgetForm, enforce: e.target.checked })} />
              Enforce limits
            </label>
            <Button onClick={saveBudget} disabled={savingBudget} className="mb-0" title="Save usage limits">
              {savingBudget ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              {savingBudget ? "Saving…" : "Save limits"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {budget?.withinBudget === false ? "⚠️ Over budget — AI calls will fail while Enforce is on." : "Within budget."}
            Current: {budget?.currentMonthTokens != null ? `${budget.currentMonthTokens.toLocaleString()} tokens` : "—"} · {budget?.currentMonthCost != null ? `$${Number(budget.currentMonthCost).toFixed(4)}` : "—"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard
          title="Total Requests"
          value={summary?.totalRequests ?? 0}
          icon={Activity}
          color="text-primary"
        />
        <StatCard
          title="Input Tokens"
          value={summary?.totalInputTokens ?? 0}
          icon={Terminal}
          color="text-blue"
        />
        <StatCard
          title="Output Tokens"
          value={summary?.totalOutputTokens ?? 0}
          icon={Terminal}
          color="text-green"
        />
        <StatCard
          title="Estimated Cost"
          value={formatCurrency(summary?.totalEstimatedCost ?? 0)}
          icon={DollarSign}
          color="text-destructive"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-3 text-muted-foreground font-medium">Time</th>
                  <th className="py-3 text-muted-foreground font-medium">Provider</th>
                  <th className="py-3 text-muted-foreground font-medium">Model</th>
                  <th className="py-3 text-muted-foreground font-medium">In Tokens</th>
                  <th className="py-3 text-muted-foreground font-medium">Out Tokens</th>
                  <th className="py-3 text-muted-foreground font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.length > 0 ? (
                  usage.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3">
                        <span className="text-muted-foreground text-xs">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-muted-foreground">
                          {log.provider?.displayName ?? "—"}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="font-medium">
                          {log.model?.displayName ?? "Unknown model"}
                          {log.model?.modelKey ? ` (${log.model.modelKey})` : ""}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {(log.inputTokens ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {(log.outputTokens ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-xs text-muted-foreground">
                          ${(
                            ((log.inputTokens ?? 0) * 0.001 + (log.outputTokens ?? 0) * 0.002) /
                            1000
                          ).toFixed(4)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No usage data for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

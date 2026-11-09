"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Users,
  Mail,
} from "lucide-react";

const COLORS = ["#4F46E5", "#0F766E", "#D97706", "#DC2626", "#15803D"];

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/reports", {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const maxStatusCount = Math.max(1, ...(report?.leadsByStatus ?? []).map((s: any) => s.count ?? 0));
  const maxSourceCount = Math.max(1, ...(report?.leadsBySource ?? []).map((s: any) => s.count ?? 0));

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
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Track lead performance, conversion rates, and pipeline health.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="Total Leads"
          value={report?.totalLeads ?? 0}
          icon={Users}
          color="text-primary"
        />
        <StatCard
          title="Won Deals"
          value={report?.wonCount ?? 0}
          icon={Target}
          color="text-green"
        />
        <StatCard
          title="Conversion Rate"
          value={`${(report?.conversionRate ?? 0).toFixed(1)}%`}
          icon={Mail}
          color="text-blue"
        />
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {(report?.leadsByStatus?.length ?? 0) > 0 ? (
                <div className="flex items-end h-full gap-2 p-4">
                  {report.leadsByStatus.map((item: any, i: number) => (
                    <div
                      key={item.status}
                      className="flex-1 flex flex-col items-center gap-1"
                      style={{ height: `${Math.min((item.count / maxStatusCount) * 100, 100)}%` }}
                    >
                      <div className={`h-4 w-full rounded-t-lg ${COLORS[i % COLORS.length]}`} />
                      <span className="text-xs text-muted-foreground">
                        {item.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                      <span className="text-xs font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(report?.leadsBySource?.length ?? 0) > 0 ? (
                report.leadsBySource.map((item: any, i: number) => (
                  <div key={item.source} className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">
                      {item.source.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                    <div className="w-full max-w-[200px] h-2 bg-border rounded-full overflow-hidden ml-4">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((item.count / maxSourceCount) * 100, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 card p-6">
        <h3 className="text-sm font-semibold mb-4">Metric Definitions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Leads", desc: "All leads in the CRM" },
            { label: "New This Week", desc: "Leads created in last 7 days" },
            { label: "Qualified", desc: "Leads with AI score >= 80" },
            { label: "Conversion Rate", desc: "Won / Total leads" },
          ].map((m) => (
            <div key={m.label} className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs font-medium">{m.label}</p>
              <p className="text-[10px] text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
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

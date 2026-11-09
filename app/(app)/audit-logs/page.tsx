"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, RefreshCw, User, Bot } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  category: string;
  actorType: string;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: any;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [actorType, setActorType] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (actorType !== "all") params.set("actorType", actorType);
      params.set("limit", "100");
      const res = await fetch(`/api/v1/audit-logs?${params}`);
      if (res.ok) {
        const d = await res.json();
        setEntries(d.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [category, actorType]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Security and activity audit trail across the platform.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="research">Research</SelectItem>
            <SelectItem value="config">Config</SelectItem>
            <SelectItem value="security">Security</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actorType} onValueChange={setActorType}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Actor type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Events ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No audit events found.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <span className="mt-0.5">
                {e.actorType === "ai" ? <Bot className="h-4 w-4 text-primary" /> : <User className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{e.action}</span>
                  <Badge variant="outline" className="text-[10px]">{e.category}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{e.actorType}</Badge>
                </div>
                {e.metadata && Object.keys(e.metadata).length > 0 && (
                  <pre className="mt-1 max-h-20 overflow-auto rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
                    {JSON.stringify(e.metadata).slice(0, 400)}
                  </pre>
                )}
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

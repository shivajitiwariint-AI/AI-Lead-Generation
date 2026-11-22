"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, RefreshCw, Users } from "lucide-react";
import Link from "next/link";

const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue/10 text-blue border-blue/20" },
  { id: "unreviewed", label: "Unreviewed", color: "bg-amber/10 text-amber border-amber/20" },
  { id: "qualified", label: "Qualified", color: "bg-green/10 text-green border-green/20" },
  { id: "contacted", label: "Contacted", color: "bg-purple/10 text-purple border-purple/20" },
  { id: "meeting_scheduled", label: "Meeting Scheduled", color: "bg-indigo/10 text-indigo border-indigo/20" },
  { id: "proposal", label: "Proposal", color: "bg-orange/10 text-orange border-orange/20" },
  { id: "won", label: "Won", color: "bg-emerald/10 text-emerald border-emerald/20" },
  { id: "lost", label: "Lost", color: "bg-red/10 text-red border-red/20" },
  { id: "disqualified", label: "Disqualified", color: "bg-gray/10 text-gray border-gray/20" },
];

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/v1/leads?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
        setTotal(data.meta?.total ?? (data.data?.length || 0));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const leadsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.id] = leads.filter((l) => l.status === stage.id);
    return acc;
  }, {} as Record<string, any[]>);

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 space-y-2">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {PIPELINE_STAGES.slice(0, 5).map((s) => (
            <div key={s.id} className="h-96 w-72 flex-shrink-0 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Visualize your leads across the sales pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLeads(true)}
            disabled={refreshing}
            title="Refresh pipeline"
            aria-label="Refresh pipeline"
          >
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
          <Button asChild>
            <a href="/leads/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Lead
            </a>
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/60" />
            <div>
              <p className="font-medium">Your pipeline is empty</p>
              <p className="text-sm text-muted-foreground">
                Run AI research or add a lead to start tracking deals.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" asChild>
                <a href="/research">Run AI research</a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href="/leads/new">Add lead</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {total > leads.length && (
            <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Showing the {leads.length} most recent of {total} leads. Use{" "}
              <Link href="/leads" className="font-medium text-primary hover:underline">
                Leads
              </Link>{" "}
              to search the full list.
            </p>
          )}
          <div className="flex flex-col gap-4 overflow-x-auto">
            <div className="inline-flex min-w-full gap-4">
              {PIPELINE_STAGES.map((stage) => {
                const stageLeads = leadsByStage[stage.id] || [];
                return (
                  <Card key={stage.id} className="w-72 flex-shrink-0 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={stage.color}>
                          {stage.label}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">{stageLeads.length}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 flex-1 min-h-[400px] max-h-[65vh] overflow-y-auto p-3 space-y-2 bg-muted/50 rounded-lg">
                      {stageLeads.length > 0 ? (
                        stageLeads.map((lead) => (
                          <div
                            key={lead.id}
                            className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
                          >
                            <Link
                              href={`/leads/${lead.id}`}
                              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                              title={`Open ${lead.name}`}
                            >
                              <p className="truncate text-sm font-medium group-hover:text-primary">
                                {lead.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {lead.company || "No company"}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {lead.email || lead.phone || "No contact"}
                              </p>
                              <div className="mt-2 flex items-center justify-between">
                                <Badge variant="outline" className="text-[10px]">
                                  Score {lead.score ?? 0}
                                </Badge>
                                {lead.ownerName && (
                                  <span className="truncate text-[10px] text-muted-foreground">
                                    {lead.ownerName}
                                  </span>
                                )}
                              </div>
                            </Link>
                            <div className="mt-2 flex justify-end">
                              <Link
                                href={`/leads/${lead.id}#email-outreach`}
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                                title={`Email ${lead.name}`}
                              >
                                <Mail className="h-3 w-3" /> Email
                              </Link>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-muted-foreground">No leads in this stage</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Target } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/leads?limit=100`, {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data || []);
      }
    } finally {
      setLoading(false);
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
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">
            Visualize your leads across the sales pipeline.
          </p>
        </div>
        <Button asChild>
          <a href="/leads/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Lead
          </a>
        </Button>
      </div>

      <div className="flex flex-col gap-4 overflow-x-auto">
        <div className="inline-flex min-w-full gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leadsByStage[stage.id] || [];
            return (
              <Card
                key={stage.id}
                className="w-72 flex-shrink-0 flex flex-col"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={stage.color}>
                      {stage.label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                      {stageLeads.length}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 min-h-[400px] overflow-y-auto p-3 space-y-2 bg-muted/50 rounded-lg">
                  {stageLeads.length > 0 ? (
                    stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-start gap-2 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-accent/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {lead.company || "No company"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {lead.email || lead.phone || "No contact"}
                          </p>
                        </div>
                        <Button size="icon" variant="outline" className="h-6 w-6 p-1 opacity-0 group-hover:opacity-100">
                          <Mail className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Empty
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Job {
  id: string;
  tenantId: string;
  jobType: string;
  status: string;
  attempts: number;
  runAt: string;
  payload: Record<string, any>;
  error: string | null;
  createdAt: string;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/jobs?limit=100", {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const retryJob = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/jobs/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify({ status: "pending", error: null }),
      });
      if (res.ok) await fetchJobs();
    } catch {
      // Error handled silently
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber/10 text-amber border-amber/20";
      case "running": return "bg-blue/10 text-blue border-blue/20";
      case "completed": return "bg-green/10 text-green border-green/20";
      case "failed": return "bg-red/10 text-red border-red/20";
      case "dead_letter": return "bg-purple/10 text-purple border-purple/20";
      default: return "bg-gray/10 text-gray border-gray/20";
    }
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
          <h1 className="text-3xl font-semibold tracking-tight">Background Jobs</h1>
          <p className="text-muted-foreground">
            Monitor and manage async job processing queue.
          </p>
        </div>
        <Button variant="outline" onClick={fetchJobs}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard
          title="Total Jobs"
          value={jobs.length}
          color="text-primary"
        />
        <StatCard
          title="Pending"
          value={jobs.filter((j) => j.status === "pending").length}
          color="text-amber"
        />
        <StatCard
          title="Completed"
          value={jobs.filter((j) => j.status === "completed").length}
          color="text-green"
        />
        <StatCard
          title="Failed"
          value={jobs.filter((j) => j.status === "failed").length}
          color="text-destructive"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-3 text-muted-foreground font-medium">Type</th>
                  <th className="py-3 text-muted-foreground font-medium">Status</th>
                  <th className="py-3 text-muted-foreground font-medium">Attempts</th>
                  <th className="py-3 text-muted-foreground font-medium">Scheduled</th>
                  <th className="py-3 text-muted-foreground font-medium text-right">Error</th>
                  <th className="py-3 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length > 0 ? (
                  jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-border hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3">
                        <span className="text-muted-foreground text-xs">
                          {job.jobType}
                        </span>
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className={statusColor(job.status)}>
                          {job.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {job.attempts}
                      </td>
                      <td className="py-3 text-muted-foreground text-xs">
                        {new Date(job.runAt).toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        {job.error ? (
                          <span className="text-destructive text-xs truncate max-w-[200px] block">
                            {job.error}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {job.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryJob(job.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No jobs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 card p-6">
        <h3 className="text-sm font-semibold mb-2">Job Types</h3>
        <p className="text-xs text-muted-foreground mb-4">
          The system processes these background job types asynchronously:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { type: "lead.ingest", desc: "Process new lead ingestion" },
            { type: "lead.deduplicate", desc: "Merge duplicate leads" },
            { type: "lead.qualify", desc: "AI lead qualification" },
            { type: "lead.enrich", desc: "Lead data enrichment" },
            { type: "chat.message.process", desc: "Process chat messages" },
            { type: "document.ingest", desc: "Process knowledge documents" },
            { type: "campaign.prepare", desc: "Prepare campaign messages" },
            { type: "message.send", desc: "Send email/WhatsApp messages" },
            { type: "followup.dispatch", desc: "Dispatch follow-up tasks" },
            { type: "integration.sync", desc: "Sync external integrations" },
          ].map((job) => (
            <div key={job.type} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <span className="text-xs font-medium">{job.type}</span>
              <span className="text-[10px] text-muted-foreground">{job.desc}</span>
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
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

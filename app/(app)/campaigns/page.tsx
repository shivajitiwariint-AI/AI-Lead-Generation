"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  objective: string | null;
  status: string;
  category: string | null;
  targetAudience: string | null;
  createdAt: string;
  _count: { campaignLeads: number };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    objective: "",
    status: "draft",
    category: "",
    targetAudience: "",
  });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/campaigns", {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify(newCampaign),
      });
      if (res.ok) {
        setShowForm(false);
        setNewCampaign({ name: "", objective: "", status: "draft", category: "", targetAudience: "" });
        await fetchCampaigns();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, current: string) => {
    try {
      const res = await fetch(`/api/v1/campaigns/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify({ status: current === "active" ? "paused" : "active" }),
      });
      if (res.ok) await fetchCampaigns();
    } catch {
      // Error handled silently
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      const res = await fetch(`/api/v1/campaigns/${id}`, {
        method: "DELETE",
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) await fetchCampaigns();
    } catch {
      // Error handled silently
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green/10 text-green border-green/20";
      case "paused": return "bg-amber/10 text-amber border-amber/20";
      case "cancelled": return "bg-red/10 text-red border-red/20";
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
          <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Create and manage lead generation campaigns.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
          >
            {showForm ? "Cancel" : "+"} Create Campaign
          </Button>
          <Button variant="outline" onClick={fetchCampaigns}>
            Refresh
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  placeholder="e.g. Q1 Software ERP Campaign"
                  value={newCampaign.name}
                  onChange={(e) =>
                    setNewCampaign({ ...newCampaign, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Objective</Label>
                <Input
                  placeholder="e.g. Generate 50 qualified leads"
                  value={newCampaign.objective}
                  onChange={(e) =>
                    setNewCampaign({ ...newCampaign, objective: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  placeholder="e.g. Software and IT"
                  value={newCampaign.category}
                  onChange={(e) =>
                    setNewCampaign({ ...newCampaign, category: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Input
                  placeholder="e.g. Business owners"
                  value={newCampaign.targetAudience}
                  onChange={(e) =>
                    setNewCampaign({ ...newCampaign, targetAudience: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Campaign"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {campaigns.length > 0 ? (
          campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{campaign.name}</span>
                </div>
                <Badge variant="outline" className={statusColor(campaign.status)}>
                  {campaign.status}
                </Badge>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {campaign.objective && (
                  <p className="text-sm text-muted-foreground">
                    {campaign.objective}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Leads</span>
                  <span className="font-medium">{campaign._count.campaignLeads}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span className="text-muted-foreground">{campaign.category || "-"}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(campaign.id, campaign.status)}
                  >
                    {campaign.status === "active" ? "Pause" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <Link href={`/campaigns/${campaign.id}`}>
                      Messages
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(campaign.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="mt-6">
            <CardContent className="text-center py-12 text-muted-foreground">
              <h3 className="text-sm font-medium">No campaigns</h3>
              <p className="text-xs mt-1">
                Create your first campaign to organize leads and outreach.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

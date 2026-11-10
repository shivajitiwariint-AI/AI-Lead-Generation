"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, RefreshCw, Settings, Target, Save } from "lucide-react";
import Link from "next/link";

interface ScoringProfile {
  id: string;
  name: string;
  description: string | null;
  fitScoreWeight: number;
  intentScoreWeight: number;
  budgetScoreWeight: number;
  companyFitWeight: number;
  contactCompletenessWeight: number;
  isDefault: boolean;
  createdAt: string;
}

export default function ScoringProfilesPage() {
  const [profiles, setProfiles] = useState<ScoringProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newProfile, setNewProfile] = useState({
    name: "",
    description: "",
    fitScoreWeight: 30,
    intentScoreWeight: 25,
    budgetScoreWeight: 20,
    companyFitWeight: 15,
    contactCompletenessWeight: 10,
    isDefault: false,
  });

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/scoring-profiles", {
        headers: { "X-Tenant-Id": "default-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/v1/scoring-profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "default-tenant-id",
        },
        body: JSON.stringify(newProfile),
      });
      if (res.ok) {
        setShowForm(false);
        setNewProfile({
          name: "",
          description: "",
          fitScoreWeight: 30,
          intentScoreWeight: 25,
          budgetScoreWeight: 20,
          companyFitWeight: 15,
          contactCompletenessWeight: 10,
          isDefault: false,
        });
        await fetchProfiles();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (id: string) => {
    // Find the profile to get current values
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;

    try {
      const res = await fetch(`/api/v1/scoring-profiles/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "default-tenant-id",
        },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchProfiles();
      }
    } catch {
      // Error handled silently
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this scoring profile?")) return;
    try {
      const res = await fetch(`/api/v1/scoring-profiles/${id}`, {
        method: "DELETE",
        headers: { "X-Tenant-Id": "default-tenant-id" },
      });
      if (res.ok) await fetchProfiles();
    } catch {
      // Error handled silently
    }
  };

  const totalWeight =
    newProfile.fitScoreWeight +
    newProfile.intentScoreWeight +
    newProfile.budgetScoreWeight +
    newProfile.companyFitWeight +
    newProfile.contactCompletenessWeight;

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
          <h1 className="text-3xl font-semibold tracking-tight">AI Scoring Profiles</h1>
          <p className="text-muted-foreground">
            Configure how AI scores and qualifies leads for different campaigns.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
          >
            {showForm ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Add Profile"}
          </Button>
          <Button variant="outline" onClick={fetchProfiles}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Scoring Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label>Profile Name</Label>
                <Input
                  placeholder="e.g. Software ERP Scoring"
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="e.g. Prioritizes modules, budget, and timeline"
                  value={newProfile.description}
                  onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Default Profile</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newProfile.isDefault}
                    onChange={(e) =>
                      setNewProfile({ ...newProfile, isDefault: e.target.checked })
                    }
                    className="rounded border-input bg-background text-primary focus:ring-ring h-4 w-4 shrink-0"
                  />
                  <label className="text-sm text-muted-foreground">
                    Set as default for new campaigns
                  </label>
                </div>
              </div>

              <Separator />
              <CardTitle className="text-sm font-medium mb-2">Score Weights</CardTitle>
              <p className="text-xs text-muted-foreground">
                Weights should total 100. Current: {totalWeight}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <WeightSlider
                  label="Requirement Fit"
                  value={newProfile.fitScoreWeight}
                  onChange={(v) => setNewProfile({ ...newProfile, fitScoreWeight: v })}
                  defaultValue={30}
                />
                <WeightSlider
                  label="Purchase Intent"
                  value={newProfile.intentScoreWeight}
                  onChange={(v) => setNewProfile({ ...newProfile, intentScoreWeight: v })}
                  defaultValue={25}
                />
                <WeightSlider
                  label="Budget Evidence"
                  value={newProfile.budgetScoreWeight}
                  onChange={(v) => setNewProfile({ ...newProfile, budgetScoreWeight: v })}
                  defaultValue={20}
                />
                <WeightSlider
                  label="Company Fit"
                  value={newProfile.companyFitWeight}
                  onChange={(v) => setNewProfile({ ...newProfile, companyFitWeight: v })}
                  defaultValue={15}
                />
                <WeightSlider
                  label="Contact Completeness"
                  value={newProfile.contactCompletenessWeight}
                  onChange={(v) => setNewProfile({ ...newProfile, contactCompletenessWeight: v })}
                  defaultValue={10}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                {totalWeight !== 100 && (
                  <span className="text-xs text-destructive">
                    Weights must total 100 (currently {totalWeight})
                  </span>
                )}
                <Button type="submit" disabled={creating || totalWeight !== 100}>
                  {creating ? "Creating..." : "Create Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {profiles.length > 0 ? (
          profiles.map((profile) => {
            const isEditing = editingId === profile.id;
            return (
              <Card key={profile.id} className="border-l-2 border-l-primary">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-sm">{profile.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {profile.description || "No description"} •
                        {profile.isDefault ? "Default" : "Custom"}
                      </p>
                    </div>
                  </div>
                  {isEditing ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(profile.id)}
                    >
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setEditingId(profile.id)}>
                      <Settings className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(profile.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </CardHeader>
                {isEditing && (
                  <CardContent className="pt-0 space-y-4 px-4 pb-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={profile.name}
                        onChange={(e) => {
                          profile.name = e.target.value;
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={profile.description || ""}
                        onChange={(e) => {
                          profile.description = e.target.value;
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Profile</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={profile.isDefault}
                          onChange={(e) => {
                            profile.isDefault = e.target.checked;
                          }}
                          className="rounded border-input bg-background text-primary focus:ring-ring h-4 w-4 shrink-0"
                        />
                        <label className="text-sm text-muted-foreground">
                          Set as default
                        </label>
                      </div>
                    </div>
                    <Separator />
                    <CardTitle className="text-sm font-medium mb-2">Score Weights</CardTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <WeightSlider
                        label="Requirement Fit"
                        value={profile.fitScoreWeight}
                        onChange={(v) => {
                          profile.fitScoreWeight = v;
                        }}
                      />
                      <WeightSlider
                        label="Purchase Intent"
                        value={profile.intentScoreWeight}
                        onChange={(v) => {
                          profile.intentScoreWeight = v;
                        }}
                      />
                      <WeightSlider
                        label="Budget Evidence"
                        value={profile.budgetScoreWeight}
                        onChange={(v) => {
                          profile.budgetScoreWeight = v;
                        }}
                      />
                      <WeightSlider
                        label="Company Fit"
                        value={profile.companyFitWeight}
                        onChange={(v) => {
                          profile.companyFitWeight = v;
                        }}
                      />
                      <WeightSlider
                        label="Contact Completeness"
                        value={profile.contactCompletenessWeight}
                        onChange={(v) => {
                          profile.contactCompletenessWeight = v;
                        }}
                      />
                    </div>
                  </CardContent>
                )}
                {!isEditing && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <WeightDisplay label="Requirement Fit" value={profile.fitScoreWeight} />
                      <WeightDisplay label="Purchase Intent" value={profile.intentScoreWeight} />
                      <WeightDisplay label="Budget Evidence" value={profile.budgetScoreWeight} />
                      <WeightDisplay label="Company Fit" value={profile.companyFitWeight} />
                      <WeightDisplay label="Contact Completeness" value={profile.contactCompletenessWeight} />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        ) : (
          <Card className="mt-6">
            <CardContent className="text-center py-12 text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-4 opacity-50" />
              <h3 className="text-sm font-medium">No scoring profiles</h3>
              <p className="text-xs mt-1">
                Create your first scoring profile to customize AI lead qualification.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WeightSlider({
  label,
  value,
  onChange,
  defaultValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  defaultValue?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs font-mono font-medium">{value}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function WeightDisplay({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

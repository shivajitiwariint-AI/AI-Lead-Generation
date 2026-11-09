"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  StopCircle,
  RefreshCw,
  Settings,
  Play,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { AISwitchCard } from "@/components/ai-switch-card";
import { cn } from "@/lib/utils";

interface AIModel {
  id: string;
  providerId: string;
  modelKey: string;
  displayName: string;
  capabilities: string[];
  enabled: boolean;
  provider: {
    id: string;
    providerKey: string;
    displayName: string;
    enabled: boolean;
  };
}

const CAPABILITY_LABELS: Record<string, string> = {
  text: "Text Generation",
  vision: "Vision",
  embeddings: "Embeddings",
  tool_calling: "Tool Calling",
  streaming: "Streaming",
};

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newModel, setNewModel] = useState({
    providerId: "",
    modelKey: "",
    displayName: "",
    capabilities: ["text"],
    enabled: true,
  });

  const [providers, setProviders] = useState<Array<{ id: string; providerKey: string; displayName: string }>>([]);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latency: number; error?: string; text?: string }>
  >({});

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsRes, providersRes] = await Promise.all([
        fetch("/api/v1/admin/ai/models", { headers: { "X-Tenant-Id": "demo-tenant-id" } }),
        fetch("/api/v1/admin/ai/providers", { headers: { "X-Tenant-Id": "demo-tenant-id" } }),
      ]);
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        setModels(data);
      }
      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.filter((p: any) => p.enabled));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/v1/admin/ai/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify(newModel),
      });
      if (res.ok) {
        setShowForm(false);
        setNewModel({ providerId: "", modelKey: "", displayName: "", capabilities: ["text"], enabled: true });
        await fetchModels();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/v1/admin/ai/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Toggle failed");
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !current } : m)));
    } catch (e: any) {
      toast.error(e.message || "Could not toggle model");
    }
  };

  const bulkToggle = async (enabled: boolean) => {
    if (!confirm(enabled ? "Enable ALL AI models?" : "Disable ALL AI models? (stops live model calls; local engine only)")) return;
    try {
      const res = await fetch("/api/v1/admin/ai/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Bulk update failed");
      toast.success(enabled ? "All models enabled" : "All models disabled — no tokens will be spent");
      await fetchModels();
    } catch (e: any) {
      toast.error(e.message || "Bulk update failed");
    }
  };

  const testModel = async (model: AIModel) => {
    setTestingModelId(model.id);
    try {
      const res = await fetch(`/api/v1/admin/ai/models/${model.id}/test`, {
        method: "POST",
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        const message = d?.error?.message || "Model test failed";
        setTestResults((prev) => ({
          ...prev,
          [model.id]: { success: false, latency: 0, error: message },
        }));
        toast.error(`${model.displayName}: ${message}`);
        return;
      }
      setTestResults((prev) => ({
        ...prev,
        [model.id]: {
          success: !!d.success,
          latency: d.latency ?? 0,
          error: d.error,
          text: d.text,
        },
      }));
      if (d.success) {
        toast.success(`${model.displayName} responded in ${d.latency} ms`);
      } else {
        toast.error(`${model.displayName}: ${d.error || "Test failed"}`);
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [model.id]: {
          success: false,
          latency: 0,
          error: "Could not reach the test endpoint",
        },
      }));
      toast.error("Could not reach the test endpoint");
    } finally {
      setTestingModelId(null);
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
      <AISwitchCard />
      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AI Models</h1>
          <p className="text-muted-foreground">
            Configure model IDs and capabilities for each provider.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => bulkToggle(true)} title="Enable every AI model at once">
            Enable all models
          </Button>
          <Button
            variant="outline"
            onClick={() => bulkToggle(false)}
            title="Disable every AI model at once — saves tokens during testing"
          >
            Disable all models
          </Button>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
          >
            {showForm ? <StopCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Add Model"}
          </Button>
          <Button variant="outline" onClick={fetchModels} title="Refresh models">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add AI Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    placeholder="Provider ID"
                    value={newModel.providerId}
                    onChange={(e) =>
                      setNewModel({ ...newModel, providerId: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model Key</Label>
                  <Input
                    placeholder="e.g. claude-3-sonnet"
                    value={newModel.modelKey}
                    onChange={(e) =>
                      setNewModel({ ...newModel, modelKey: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    placeholder="e.g. Claude 3 Sonnet"
                    value={newModel.displayName}
                    onChange={(e) =>
                      setNewModel({ ...newModel, displayName: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={creating}>
                    {creating ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Capabilities</Label>
                <div className="flex flex-wrap gap-2">
                  {["text", "vision", "embeddings", "tool_calling", "streaming"].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => {
                        const caps = newModel.capabilities;
                        if (caps.includes(cap)) {
                          setNewModel({ ...newModel, capabilities: caps.filter((c) => c !== cap) });
                        } else {
                          setNewModel({ ...newModel, capabilities: [...caps, cap] });
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                        newModel.capabilities.includes(cap)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      {CAPABILITY_LABELS[cap] || cap}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newModel.enabled}
                  onChange={(e) =>
                    setNewModel({ ...newModel, enabled: e.target.checked })
                  }
                  className="rounded border-input bg-background text-primary focus:ring-ring h-4 w-4 shrink-0"
                />
                <label className="text-sm text-muted-foreground">
                  Enabled by default
                </label>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="py-3 pr-4 text-muted-foreground font-medium">Model</th>
              <th className="py-3 text-muted-foreground font-medium">Provider</th>
              <th className="py-3 text-muted-foreground font-medium">Capabilities</th>
              <th className="py-3 text-muted-foreground font-medium">Status</th>
              <th className="py-3 text-right text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.length > 0 ? (
              models.map((model) => (
                <tr
                  key={model.id}
                  className="border-b border-border hover:bg-muted/50 transition-colors"
                >
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <Settings className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{model.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {model.modelKey}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span className="text-muted-foreground">
                      {model.provider.displayName}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-1">
                      {model.capabilities.map((cap) => (
                        <Badge key={cap} variant="outline" className="text-xs">
                          {CAPABILITY_LABELS[cap] || cap}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={model.enabled ? "secondary" : "outline"}>
                          {model.enabled ? "Active" : "Inactive"}
                        </Badge>
                        <Switch
                          checked={model.enabled}
                          onCheckedChange={() => handleToggle(model.id, model.enabled)}
                          title={model.enabled ? `Disable ${model.displayName}` : `Enable ${model.displayName}`}
                        />
                      </div>
                      {testResults[model.id] && (
                        <span
                          className={cn(
                            "text-xs",
                            testResults[model.id].success
                              ? "text-emerald-600"
                              : "text-destructive"
                          )}
                          title={testResults[model.id].error}
                        >
                          {testResults[model.id].success
                            ? `OK · ${testResults[model.id].latency} ms`
                            : "Test failed"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testModel(model)}
                      disabled={testingModelId !== null}
                      title={
                        testResults[model.id]?.error ||
                        "Send a minimal real request to this model"
                      }
                    >
                      {testingModelId === model.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      <span className="ml-1">
                        {testingModelId === model.id ? "Testing…" : "Test"}
                      </span>
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  No models configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {models.length === 0 && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">
            First add a provider on the <a href="/ai-providers" className="text-primary hover:underline">AI Providers</a> page, then add models here.
          </p>
        </div>
      )}
    </div>
  );
}

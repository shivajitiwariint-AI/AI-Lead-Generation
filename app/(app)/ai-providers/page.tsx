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
  Edit2,
  ShieldCheck,
  RefreshCw,
  Key,
  Settings,
  Link as LinkIcon,
  BarChart3,
  Play,
  StopCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PublicChat } from "@/components/public-chat";

const PROVIDER_INFO: Record<string, { description: string; icon: string }> = {
  anthropic: {
    description: "Anthropic Claude - Advanced reasoning and analysis",
    icon: "ShieldCheck",
  },
  google_gemini: {
    description: "Google Gemini - Multimodal AI with large context",
    icon: "ShieldCheck",
  },
  xai_grok: {
    description: "xAI Grok - Real-time knowledge and reasoning",
    icon: "ShieldCheck",
  },
  ollama: {
    description: "Ollama - Local/self-hosted models",
    icon: "ShieldCheck",
  },
  groq: {
    description: "Groq - Ultra-fast inference (GPT-OSS, Llama, Qwen)",
    icon: "ShieldCheck",
  },
  openai: {
    description: "OpenAI - GPT models (optional provider)",
    icon: "ShieldCheck",
  },
};

interface AIProvider {
  id: string;
  providerKey: string;
  displayName: string;
  enabled: boolean;
  models: Array<{ id: string; modelKey: string; displayName: string; enabled: boolean }>;
  _count: { credentials: number };
}

export default function AIProvidersPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; latency?: number; error?: string; model?: string }>>({});
  const [showForm, setShowForm] = useState(false);
  const [newProvider, setNewProvider] = useState({
    providerKey: "anthropic",
    displayName: "",
    enabled: true,
  });
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [showKeyForm, setShowKeyForm] = useState<Record<string, boolean>>({});
  const [settingKey, setSettingKey] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/ai/providers", {
        headers: { "X-Tenant-Id": "default-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/v1/admin/ai/providers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "default-tenant-id",
        },
        body: JSON.stringify(newProvider),
      });
      if (res.ok) {
        setShowForm(false);
        setNewProvider({ providerKey: "anthropic", displayName: "", enabled: true });
        await fetchProviders();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSetKey = async (id: string) => {
    const key = keyInputs[id]?.trim();
    if (!key) {
      toast.error("Enter an API key first");
      return;
    }
    setSettingKey(id);
    try {
      const res = await fetch(`/api/v1/admin/ai/providers/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "default-tenant-id",
        },
        body: JSON.stringify({ apiKey: key }),
      });
      if (res.ok) {
        const d = await res.json();
        toast.success(`API key saved (${d.masked ?? "****"})`);
        setKeyInputs((prev) => ({ ...prev, [id]: "" }));
        setShowKeyForm((prev) => ({ ...prev, [id]: false }));
        await fetchProviders();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error?.message || "Could not save key");
      }
    } finally {
      setSettingKey(null);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/v1/admin/ai/providers/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "default-tenant-id",
        },
        body: JSON.stringify({ enabled: !current }),
      });
      if (res.ok) await fetchProviders();
    } catch {
      // Error handled silently
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider?")) return;
    try {
      const res = await fetch(`/api/v1/admin/ai/providers/${id}`, {
        method: "DELETE",
        headers: { "X-Tenant-Id": "default-tenant-id" },
      });
      if (res.ok) await fetchProviders();
    } catch {
      // Error handled silently
    }
  };

  const handleTestConnection = async (id: string, providerKey: string) => {
    setTestResults((prev) => ({ ...prev, [id]: { success: false } }));
    try {
      const res = await fetch(
        `/api/v1/admin/ai/providers/${id}/test`,
        {
          method: "POST",
          headers: { "X-Tenant-Id": "default-tenant-id" },
        }
      );
      if (res.ok) {
        const result = await res.json();
        setTestResults((prev) => ({
          ...prev,
          [id]: { success: result.success, latency: result.latency, error: result.error, model: result.model },
        }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false } }));
    }
  };

  const ProviderIcon = ({ providerKey }: { providerKey: string }) => {
    const icons: Record<string, React.ElementType> = {
      anthropic: ShieldCheck,
      google_gemini: ShieldCheck,
      xai_grok: ShieldCheck,
      ollama: ShieldCheck,
      openai: ShieldCheck,
    };
    const Icon = icons[providerKey] || ShieldCheck;
    return <Icon className="h-4 w-4" />;
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
          <h1 className="text-3xl font-semibold tracking-tight">AI Providers</h1>
          <p className="text-muted-foreground">
            Configure and manage AI model providers for your platform.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
          >
            {showForm ? <StopCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Add Provider"}
          </Button>
          <Button
            variant="outline"
            onClick={fetchProviders}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add AI Provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Input
                    value={newProvider.providerKey}
                    onChange={(e) =>
                      setNewProvider({ ...newProvider, providerKey: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    placeholder="e.g. Anthropic Claude"
                    value={newProvider.displayName}
                    onChange={(e) =>
                      setNewProvider({ ...newProvider, displayName: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={creating}
                  >
                    {creating ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newProvider.enabled}
                  onChange={(e) =>
                    setNewProvider({ ...newProvider, enabled: e.target.checked })
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

      <div className="grid gap-6 md:grid-cols-3">
        {providers.map((provider) => {
          const info = PROVIDER_INFO[provider.providerKey] || {
            description: "AI provider integration",
            icon: "ShieldCheck",
          };
          const hasCredential = provider._count.credentials > 0;
          const testResult = testResults[provider.id];
          return (
            <Card key={provider.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <ProviderIcon providerKey={provider.providerKey} />
                  <span className="font-semibold">{provider.displayName}</span>
                </div>
                <Badge
                  variant={provider.enabled ? "secondary" : "outline"}
                  className={cn(
                    provider.enabled ? "bg-emerald/10 text-emerald" : "bg-muted/50 text-muted-foreground"
                  )}
                >
                  {provider.enabled ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {info.description}
                </p>
                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">API Credential</span>
                    <Badge variant="outline">
                      {hasCredential ? "Configured" : "Not set"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Models</span>
                    <span className="font-medium">
                      {provider.models.length}
                    </span>
                  </div>
                </div>

                {showKeyForm[provider.id] ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <Label className="text-xs">API key for {provider.displayName}</Label>
                    <Input
                      type="password"
                      value={keyInputs[provider.id] ?? ""}
                      onChange={(e) => setKeyInputs((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                      placeholder="Paste API key…"
                      className="h-8 text-xs"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSetKey(provider.id); }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSetKey(provider.id)}
                        disabled={settingKey === provider.id}
                      >
                        {settingKey === provider.id ? "Saving…" : "Save key"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowKeyForm((prev) => ({ ...prev, [provider.id]: false }))}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowKeyForm((prev) => ({ ...prev, [provider.id]: true }))}
                  >
                    <Key className="h-3 w-3 mr-1" />
                    {hasCredential ? "Update key" : "Set key"}
                  </Button>
                )}

                <Separator />

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(provider.id, provider.enabled)}
                  >
                    {provider.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection(provider.id, provider.providerKey)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Test
                  </Button>
                  {testResult && (
                    <Badge
                      variant={testResult.success ? "secondary" : "destructive"}
                      title={testResult.error ?? undefined}
                    >
                      {testResult.success ? `Connected (${testResult.latency}ms)${testResult.model ? " · " + testResult.model : ""}` : "Failed"}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(provider.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {testResult && !testResult.success && testResult.error && (
                  <p className="mt-2 break-words text-[10px] text-destructive">{testResult.error}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {providers.length === 0 && (
        <Card className="mt-6">
          <CardContent className="text-center py-12 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-4 opacity-50" />
            <h3 className="text-sm font-medium">No providers configured</h3>
            <p className="text-xs mt-1">
              Add your first AI provider to enable AI features.
            </p>
          </CardContent>
        </Card>
      )}
      <PublicChat />
    </div>
  );
}

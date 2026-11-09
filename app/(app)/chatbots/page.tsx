"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface Chatbot {
  id: string;
  name: string;
  publicKey: string;
  settings: Record<string, any>;
  status: string;
  createdAt: string;
  _count?: { conversations: number };
}

export default function ChatbotsPage() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newChatbot, setNewChatbot] = useState({
    name: "",
    status: "active",
  });

  const fetchChatbots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/chatbots", {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setChatbots(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChatbots();
  }, [fetchChatbots]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatbot.name.trim()) {
      toast.error("Enter a chatbot name");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/chatbots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify({
          name: newChatbot.name.trim(),
          status: newChatbot.status,
          settings: {
            welcomeMessage: `Hi! I'm ${newChatbot.name.trim()}. Ask me about our services.`,
            leadCaptureEnabled: true,
            useKnowledgeBase: true,
            usePublicDocs: true,
          },
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Create failed");
      toast.success("Chatbot created — RAG enabled");
      setShowForm(false);
      setNewChatbot({ name: "", status: "active" });
      await fetchChatbots();
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const copySnippet = async (publicKey: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
    try {
      await navigator.clipboard.writeText(`<script src="${origin}/api/v1/public/chat/${publicKey}/widget.js"></script>`);
      toast.success("Embed snippet copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const res = await fetch(`/api/v1/chatbots/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify({ status: !current ? "active" : "inactive" }),
      });
      if (res.ok) await fetchChatbots();
    } catch {
      // Error handled silently
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this chatbot?")) return;
    try {
      const res = await fetch(`/api/v1/chatbots/${id}`, {
        method: "DELETE",
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) await fetchChatbots();
    } catch {
      // Error handled silently
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
          <h1 className="text-3xl font-semibold tracking-tight">Chatbots</h1>
          <p className="text-muted-foreground">
            Configure website chatbots for lead capture and customer support.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
          >
            {showForm ? "Cancel" : "+"} Add Chatbot
          </Button>
          <Button variant="outline" onClick={fetchChatbots}>
            Refresh
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create Chatbot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label>Chatbot Name</Label>
                <Input
                  placeholder="e.g. Support Bot"
                  value={newChatbot.name}
                  onChange={(e) =>
                    setNewChatbot({ ...newChatbot, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input
                  value={newChatbot.status}
                  onChange={(e) =>
                    setNewChatbot({ ...newChatbot, status: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Chatbot"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {chatbots.length > 0 ? (
          chatbots.map((chatbot) => (
            <Card key={chatbot.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{chatbot.name}</span>
                </div>
                <Badge
                  variant={chatbot.status === "active" ? "secondary" : "outline"}
                >
                  {chatbot.status}
                </Badge>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Public Key</span>
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {chatbot.publicKey}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Conversations</span>
                    <span className="font-medium">{chatbot._count?.conversations ?? 0}</span>
                  </div>
                  <div className="rounded-lg bg-muted p-2 font-mono text-[10px] break-all">
                    &lt;script src={`${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1/public/chat/${chatbot.publicKey}/widget.js`}&gt;
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggle(chatbot.id, chatbot.status === "active")}
                  >
                    {chatbot.status === "active" ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <Link href={`/chatbots/${chatbot.id}`}>
                      Configure
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copySnippet(chatbot.publicKey)}
                    title="Copy embed script"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(chatbot.id)}
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
              <h3 className="text-sm font-medium">No chatbots configured</h3>
              <p className="text-xs mt-1">
                Click “+ Add Chatbot” — we’ll create a RAG bot linked to your Knowledge Base + Public Docs and give you an embed script.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-8 card p-6">
        <h3 className="text-sm font-semibold mb-2">Embed Script</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Create a chatbot above, then copy its per-bot script from the card. Each key talks only to its tenant’s RAG sources.
        </p>
        <div className="bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto">
          {chatbots.length
            ? chatbots.map((b) => (
                <div key={b.id} className="mb-2 last:mb-0">
                  {`<!-- ${b.name} -->`}
                  <br />
                  {`<script src="${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/v1/public/chat/${b.publicKey}/widget.js"></script>`}
                </div>
              ))
            : `<script src="https://your-domain.com/api/v1/public/chat/PUBLIC_KEY/widget.js"></script>`}
        </div>
      </div>
    </div>
  );
}

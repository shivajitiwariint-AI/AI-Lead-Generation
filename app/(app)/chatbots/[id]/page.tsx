"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Copy, Loader2, Save, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Bot {
  id: string;
  name: string;
  publicKey: string;
  settings: Record<string, any>;
  status: string;
}

function ConfigureForm() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(true);
  const [useKB, setUseKB] = useState(true);
  const [usePublic, setUsePublic] = useState(true);

  const [q, setQ] = useState("What services do you offer?");
  const [testAnswer, setTestAnswer] = useState("");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/chatbots", { headers: { "X-Tenant-Id": "demo-tenant-id" } });
      const list = await res.json().catch(() => []);
      const found = (Array.isArray(list) ? list : []).find((b: any) => b.id === id);
      if (!found) {
        toast.error("Chatbot not found");
        router.push("/chatbots");
        return;
      }
      setBot(found);
      setName(found.name ?? "");
      setEnabled(found.status === "active");
      const s = (found.settings ?? {}) as Record<string, any>;
      setWelcomeMessage(s.welcomeMessage ?? `Hi! I'm ${found.name}. Ask me about our services.`);
      setLeadCaptureEnabled(s.leadCaptureEnabled !== false);
      setUseKB(s.useKnowledgeBase !== false);
      setUsePublic(s.usePublicDocs !== false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const save = async () => {
    if (!bot) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/chatbots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Tenant-Id": "demo-tenant-id" },
        body: JSON.stringify({
          name: name.trim(),
          status: enabled ? "active" : "inactive",
          settings: {
            ...(bot.settings ?? {}),
            welcomeMessage: welcomeMessage.trim(),
            leadCaptureEnabled,
            useKnowledgeBase: useKB,
            usePublicDocs: usePublic,
          },
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Save failed");
      setBot(d);
      toast.success("Chatbot updated");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const copyEmbed = async () => {
    if (!bot) return;
    const url = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
    const snippet = `<script src="${url}/api/v1/public/chat/${bot.publicKey}/widget.js"></script>`;
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Embed snippet copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  const test = async () => {
    if (!bot || !q.trim()) return;
    setTesting(true);
    try {
      const res = await fetch(`/api/v1/public/chat/${bot.publicKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Test failed");
      setTestAnswer(d.answer ?? "");
    } catch (e: any) {
      toast.error(e.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  if (loading || !bot) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl space-y-6">
      <Link href="/chatbots" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to chatbots
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Configure — {bot.name}</CardTitle>
          <CardDescription>RAG settings, lead capture and embed snippet. Changes apply immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Chatbot Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <span className="text-sm">{enabled ? "Active" : "Inactive"}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Welcome message</Label>
            <Input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={useKB} onCheckedChange={setUseKB} /> Use Knowledge Base (RAG)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={usePublic} onCheckedChange={setUsePublic} /> Use Public Docs
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={leadCaptureEnabled} onCheckedChange={setLeadCaptureEnabled} /> Lead capture
            </label>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} title="Save chatbot settings">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embed script</CardTitle>
          <CardDescription>Paste this on any website — renders a floating chat bubble that calls this bot’s RAG endpoint.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg bg-muted p-3 font-mono text-xs break-all">
            {`<script src="${origin}/api/v1/public/chat/${bot.publicKey}/widget.js"></script>`}
          </div>
          <Button variant="outline" size="sm" onClick={copyEmbed} title="Copy embed script">
            <Copy className="mr-1 h-4 w-4" /> Copy script
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live test</CardTitle>
          <CardDescription>Ask a question through the public endpoint (no login needed).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask something…" />
            <Button onClick={test} disabled={testing} title="Send test question">
              {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              {testing ? "Thinking…" : "Send"}
            </Button>
          </div>
          {testAnswer && (
            <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap">
              <CheckCircle2 className="mb-1 h-4 w-4 text-emerald-600" />
              {testAnswer}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ChatbotConfigurePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ConfigureForm />
    </Suspense>
  );
}

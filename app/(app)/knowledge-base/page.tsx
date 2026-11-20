"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Chatbot {
  id: string;
  name: string;
}

interface KnowledgeDocument {
  id: string;
  chatbotId: string;
  fileRef: string;
  status: string;
  chunkCount?: number;
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newDoc, setNewDoc] = useState({
    chatbotId: "",
    title: "",
    content: "",
  });

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/knowledge-documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetch("/api/v1/chatbots")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setChatbots(Array.isArray(d) ? d : []))
      .catch(() => setChatbots([]));
  }, [fetchDocuments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.chatbotId) {
      toast.error("Choose the chatbot this document belongs to");
      return;
    }
    if (!newDoc.title.trim() || !newDoc.content.trim()) {
      toast.error("Add a title and paste the document text");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/knowledge-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId: newDoc.chatbotId,
          title: newDoc.title.trim(),
          content: newDoc.content,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Create failed");
      toast.success(
        d?.chunkCount
          ? `Document added — ${d.chunkCount} chunk(s) available to the chatbot`
          : "Document added"
      );
      setShowForm(false);
      setNewDoc({ chatbotId: "", title: "", content: "" });
      await fetchDocuments();
    } catch (e: any) {
      toast.error(e.message || "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document and its indexed chunks?")) return;
    try {
      const res = await fetch(`/api/v1/knowledge-documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Document deleted");
      await fetchDocuments();
    } catch {
      toast.error("Could not delete document");
    }
  };

  const chatbotName = (id: string) => chatbots.find((c) => c.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Paste the facts your chatbot should answer from. Text is split into chunks and used for retrieval.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> {showForm ? "Cancel" : "Add document"}
          </Button>
          <Button variant="outline" onClick={fetchDocuments} disabled={loading} title="Refresh documents">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {chatbots.length === 0 && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6 text-sm">
            <span>Create a chatbot first — documents are attached to a chatbot.</span>
            <Button size="sm" asChild>
              <Link href="/chatbots">Create chatbot</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add knowledge document</CardTitle>
            <CardDescription>Plain text works best. Up to 200,000 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Chatbot</Label>
                  <Select
                    value={newDoc.chatbotId}
                    onValueChange={(v: string) => setNewDoc({ ...newDoc, chatbotId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a chatbot" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatbots.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-title">Title</Label>
                  <Input
                    id="doc-title"
                    placeholder="e.g. Pricing and plans FAQ"
                    value={newDoc.title}
                    onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-content">Document text</Label>
                <Textarea
                  id="doc-content"
                  rows={10}
                  placeholder="Paste your FAQ, service description, pricing details or policies here…"
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {newDoc.content.trim().length.toLocaleString()} characters
                </p>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding…" : "Add document"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="flex justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : documents.length > 0 ? (
          documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{doc.fileRef}</CardTitle>
                    <CardDescription>
                      {chatbotName(doc.chatbotId)} · added {new Date(doc.createdAt).toLocaleDateString()}
                      {typeof doc.chunkCount === "number" ? ` · ${doc.chunkCount} chunk(s) indexed` : ""}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant={
                    doc.status === "completed" ? "secondary" : doc.status === "failed" ? "destructive" : "outline"
                  }
                >
                  {doc.status}
                </Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex justify-end">
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(doc.id)}>
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <h3 className="text-sm font-medium text-foreground">No documents yet</h3>
              <p className="mx-auto mt-1 max-w-md text-xs">
                Add your FAQ, service details or pricing so your chatbot answers from your own content instead of
                guessing.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

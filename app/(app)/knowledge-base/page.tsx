"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface KnowledgeDocument {
  id: string;
  chatbotId: string;
  fileRef: string;
  status: string;
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newDoc, setNewDoc] = useState({
    chatbotId: "",
    fileRef: "",
    status: "processing",
  });

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/knowledge-documents", {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/v1/knowledge-documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "demo-tenant-id",
        },
        body: JSON.stringify(newDoc),
      });
      if (res.ok) {
        setShowForm(false);
        setNewDoc({ chatbotId: "", fileRef: "", status: "processing" });
        await fetchDocuments();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await fetch(`/api/v1/knowledge-documents/${id}`, {
        method: "DELETE",
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) await fetchDocuments();
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
          <h1 className="text-3xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Manage documents for RAG-powered chatbot responses.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
          >
            {showForm ? "Cancel" : "+"} Add Document
          </Button>
          <Button variant="outline" onClick={fetchDocuments}>
            Refresh
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add Knowledge Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label>Chatbot ID</Label>
                <Input
                  placeholder="Chatbot ID"
                  value={newDoc.chatbotId}
                  onChange={(e) =>
                    setNewDoc({ ...newDoc, chatbotId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>File Reference (Storage Key)</Label>
                <Input
                  placeholder="e.g. documents/faq.pdf"
                  value={newDoc.fileRef}
                  onChange={(e) =>
                    setNewDoc({ ...newDoc, fileRef: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input
                  value={newDoc.status}
                  onChange={(e) =>
                    setNewDoc({ ...newDoc, status: e.target.value })
                  }
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Add Document"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {documents.length > 0 ? (
          documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{doc.fileRef}</span>
                </div>
                <Badge
                  variant={
                    doc.status === "completed"
                      ? "secondary"
                      : doc.status === "failed"
                      ? "destructive"
                      : "outline"
                  }
                >
                  {doc.status}
                </Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Chatbot ID</span>
                  <span className="font-medium">{doc.chatbotId}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploaded</span>
                  <span className="text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(doc.id)}
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="mt-6">
            <CardContent className="text-center py-12 text-muted-foreground">
              <h3 className="text-sm font-medium">No documents</h3>
              <p className="text-xs mt-1">
                Upload documents to power your chatbot's RAG responses.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-8 card p-6">
        <h3 className="text-sm font-semibold mb-2">Supported Document Types</h3>
        <p className="text-xs text-muted-foreground mb-4">
          PDF, DOCX, TXT, and Markdown. Documents are processed, chunked, and embedded for RAG retrieval.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["PDF", "DOCX", "TXT", "Markdown"].map((type) => (
            <div key={type} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <span className="text-xs font-medium">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

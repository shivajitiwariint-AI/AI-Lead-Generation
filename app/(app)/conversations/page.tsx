"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Bot, User, Clock, MessageCircle, Plus, Sparkles, Hand } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Conversation {
  id: string;
  visitorRef: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
  lead: { id: string; name: string; email: string } | null;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  metadata: Record<string, any>;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/conversations", {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const fetchMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/conversations/${id}/messages`, {
        headers: { "X-Tenant-Id": "demo-tenant-id" },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch {
      // Error handled silently
    }
  }, []);

  const handleSelect = (conv: Conversation) => {
    setSelectedConversation(conv);
    setMessages([]);
    fetchMessages(conv.id);
  };

  const handleNew = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Could not create conversation");
      toast.success("New RAG conversation started");
      await fetchConversations();
      handleSelect(d as Conversation);
    } catch (e: any) {
      toast.error(e.message || "Could not create conversation");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/v1/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-Id": "demo-tenant-id",
          },
          body: JSON.stringify({ role: "user", content: newMessage }),
        }
      );
      const d = await res.json().catch(() => null);
      if (res.ok) {
        setNewMessage("");
        await fetchMessages(selectedConversation.id!);
        if (d?.assistantMessage) {
          toast.success("AI replied (RAG)");
        }
      } else {
        toast.error(d?.error?.message || "Send failed");
      }
    } catch {
      toast.error("Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleHandoff = async () => {
    if (!selectedConversation) return;
    if (!confirm("Hand this conversation to manual? AI will stop replying.")) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Tenant-Id": "demo-tenant-id" },
        body: JSON.stringify({ action: "handoff" }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error?.message || "Handoff failed");
      setSelectedConversation((p) => (p ? { ...p, status: "handoff_requested" } : p));
      toast.success("Manual takeover — AI paused for this conversation");
      fetchConversations();
    } catch (e: any) {
      toast.error(e.message || "Handoff failed");
    } finally {
      setSending(false);
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/dashboard" className="text-primary hover:underline">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span>Conversations</span>
      </div>

      <div className="flex h-[600px]">
        {/* Conversation list */}
        <div className="w-1/3 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <div className="flex gap-1">
              <Button size="sm" onClick={handleNew} disabled={sending} title="Start new RAG conversation">
                <Plus className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={fetchConversations} title="Refresh conversations">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {conversations.length > 0 ? (
              conversations.map((conv) => {
                const title = conv.lead?.name ?? (conv.visitorRef?.startsWith("internal-") ? "Internal AI chat" : conv.visitorRef ?? "Visitor");
                return (
                <div
                  key={conv.id}
                  onClick={() => handleSelect(conv)}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors mb-2",
                    selectedConversation?.id === conv.id
                      ? "bg-primary/10 border border-primary"
                      : "bg-background hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${conv.status === "handoff_requested" ? "bg-amber-500" : "bg-green-500"}`} />
                    <span className="text-sm font-medium truncate flex-1">{title}</span>
                    <Badge variant={conv.status === "handoff_requested" ? "secondary" : "outline"} className="text-[10px]">
                      {conv.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lead?.email ?? (conv.visitorRef?.startsWith("internal-") ? "Staff test chat" : "Website visitor")} · {conv._count?.messages ?? 0} msgs
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(conv.updatedAt).toLocaleString()}</p>
                </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground px-3">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="mt-1 text-xs leading-relaxed">Click <strong>+ New</strong> to test the RAG assistant (Knowledge Base + Public Docs). Website and chatbot chats appear here automatically.</p>
              </div>
            )}
          </div>
        </div>

        {/* Active conversation */}
        <div className="flex-1 flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <MessageCircle className="h-8 w-8 opacity-50" />
              <p className="text-sm font-medium">Select a conversation to view messages</p>
              <p className="max-w-sm text-xs leading-relaxed">
                Conversations come from your website chatbots (embed script on Chatbots) and internal RAG tests. The AI answers from your Knowledge Base + Public Docs, books meetings, and hands off when you click Handoff.
              </p>
              <Button size="sm" onClick={handleNew} disabled={sending} title="Start a new RAG conversation">
                <Plus className="h-3 w-3 mr-1" /> New conversation
              </Button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedConversation.lead?.name || selectedConversation.visitorRef}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.lead?.email || "Website visitor"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {selectedConversation.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                  {selectedConversation.status !== "handoff_requested" && (
                    <Button size="sm" variant="outline" onClick={handleHandoff} disabled={sending} title="Hand to manual — AI stops replying">
                      <Hand className="h-3 w-3 mr-1" /> Handoff
                    </Button>
                  )}
                  <Button size="sm" variant="outline" title="Open chat actions">
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length > 0 ? (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        msg.role === "user" ? "flex-row-reverse" : ""
                      )}
                    >
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {msg.role === "user" ? "U" : "A"}
                      </div>
                      <div
                        className={cn(
                          "max-w-[80%] p-3 rounded-lg",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-muted text-foreground rounded-tl-none"
                        )}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No messages yet
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={sending}
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()}>
                    Send
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

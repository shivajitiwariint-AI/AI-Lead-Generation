"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Globe, Webhook, Bot, Check, Plus } from "lucide-react";

type Integration = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  connected: boolean;
  accent: string;
};

const INITIAL: Integration[] = [
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Reply to leads and send follow-ups directly from WhatsApp.",
    category: "Messaging",
    icon: <MessageCircle className="h-5 w-5" />,
    connected: false,
    accent: "bg-emerald/10 text-emerald",
  },
  {
    id: "email",
    name: "Email (Resend)",
    description: "Transactional email delivery for campaigns and alerts.",
    category: "Messaging",
    icon: <Mail className="h-5 w-5" />,
    connected: false,
    accent: "bg-blue/10 text-blue",
  },
  {
    id: "website",
    name: "Website Widget",
    description: "Embed the AI chatbot on your site with a single script tag.",
    category: "Capture",
    icon: <Globe className="h-5 w-5" />,
    connected: true,
    accent: "bg-indigo/10 text-indigo",
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "Push lead and conversation events to your own endpoints.",
    category: "Developer",
    icon: <Webhook className="h-5 w-5" />,
    connected: false,
    accent: "bg-amber/10 text-amber",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect leads to 5,000+ apps without writing code.",
    category: "Automation",
    icon: <Bot className="h-5 w-5" />,
    connected: false,
    accent: "bg-purple/10 text-purple",
  },
];

export default function IntegrationsPage() {
  const [items, setItems] = React.useState(INITIAL);

  const toggle = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)));

  const connectedCount = items.filter((i) => i.connected).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect the tools your team already uses to capture and act on leads.
          </p>
        </div>
        <Badge variant="secondary">
          {connectedCount} of {items.length} connected
        </Badge>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.accent}`}
                >
                  {item.icon}
                </span>
                <Badge variant={item.connected ? "default" : "outline"}>
                  {item.connected ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    "Not connected"
                  )}
                </Badge>
              </div>
              <CardTitle className="text-base">{item.name}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between gap-3 pt-0">
              <span className="text-xs text-muted-foreground">{item.category}</span>
              <Button
                size="sm"
                variant={item.connected ? "outline" : "default"}
                onClick={() => toggle(item.id)}
              >
                {item.connected ? "Disconnect" : <span className="flex items-center gap-1"><Plus className="h-4 w-4" /> Connect</span>}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

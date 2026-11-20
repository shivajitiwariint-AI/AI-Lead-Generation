"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmtpCard } from "@/components/smtp-card";
import { MessageCircle, Globe, Webhook, Bot, Plug } from "lucide-react";
import Link from "next/link";

type PlannedIntegration = {
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  accent: string;
};

// These connectors are not built yet. They are shown without connect buttons so
// the page never claims a capability the platform doesn't have.
const PLANNED: PlannedIntegration[] = [
  {
    name: "WhatsApp Business",
    description: "Reply to leads and send follow-ups directly from WhatsApp.",
    category: "Messaging",
    icon: <MessageCircle className="h-5 w-5" />,
    accent: "bg-emerald/10 text-emerald",
  },
  {
    name: "Webhooks",
    description: "Push lead and conversation events to your own endpoints.",
    category: "Developer",
    icon: <Webhook className="h-5 w-5" />,
    accent: "bg-amber/10 text-amber",
  },
  {
    name: "Zapier",
    description: "Connect leads to 5,000+ apps without writing code.",
    category: "Automation",
    icon: <Bot className="h-5 w-5" />,
    accent: "bg-purple/10 text-purple",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect the tools your team already uses to capture and act on leads.
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Plug className="h-3 w-3" /> Email delivery is configurable
        </Badge>
      </div>

      <SmtpCard />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo/10 text-indigo">
              <Globe className="h-5 w-5" />
            </span>
            <Badge variant="secondary">Ready</Badge>
          </div>
          <CardTitle className="text-base">Website widget</CardTitle>
          <CardDescription>
            Embed the AI chatbot on your site with a single script tag and capture leads automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3 pt-0">
          <span className="text-xs text-muted-foreground">Capture</span>
          <Button size="sm" asChild>
            <Link href="/chatbots">Get embed snippet</Link>
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-1 text-lg font-semibold">Not available yet</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          These connectors are planned. Nothing here is silently switched on.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {PLANNED.map((item) => (
            <Card key={item.name} className="flex flex-col opacity-90">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.accent}`}>
                    {item.icon}
                  </span>
                  <Badge variant="outline">Planned</Badge>
                </div>
                <CardTitle className="text-base">{item.name}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-3 pt-0">
                <span className="text-xs text-muted-foreground">{item.category}</span>
                <Button size="sm" variant="outline" disabled>
                  Coming soon
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

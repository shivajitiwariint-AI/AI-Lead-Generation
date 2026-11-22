export type ActivityCategory =
  | "email"
  | "meeting"
  | "followup"
  | "status"
  | "ai"
  | "control"
  | "note"
  | "other";

export interface ActivityDescription {
  title: string;
  description?: string;
  category: ActivityCategory;
}

function asRecord(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, any>) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function score(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pretty(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function when(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Convert a stored lead activity into plain language for the timeline.
 * Handles both JSON objects and JSON strings (older rows store strings).
 */
export function describeActivity(
  type: string,
  rawPayload: unknown,
  resolveName?: (userId: string) => string | undefined
): ActivityDescription {
  const p = asRecord(rawPayload);

  switch (type) {
    case "lead_created":
      return {
        title: "Lead added",
        description:
          p.source === "research" ? "Created by AI research from your target criteria." : "Added to your pipeline.",
        category: "status",
      };
    case "ai_qualification_completed": {
      const parts = [
        score(p.fitScore) !== undefined ? `Fit ${score(p.fitScore)}` : null,
        score(p.intentScore) !== undefined ? `Intent ${score(p.intentScore)}` : null,
        score(p.urgencyScore) !== undefined ? `Urgency ${score(p.urgencyScore)}` : null,
      ].filter(Boolean);
      return {
        title: "AI qualification completed",
        description: parts.length ? `${parts.join(" · ")} out of 100.` : undefined,
        category: "ai",
      };
    }
    case "email_generated":
      return {
        title: "Email draft created",
        description: text(p.subject),
        category: "email",
      };
    case "email_approved":
      return { title: "Email approved", description: "Ready to be sent.", category: "email" };
    case "email_rejected": {
      const note = text(p.note);
      return {
        title: "Email rejected",
        description: note && note !== "Rejected from lead page" ? note : "This draft was not sent.",
        category: "email",
      };
    }
    case "email_sent":
      return {
        title: "Email sent",
        description: text(p.to) ? `Delivered to ${text(p.to)}.` : "Delivered to the lead.",
        category: "email",
      };
    case "email_simulated":
      return {
        title: "Email not delivered",
        description: "No email provider was configured, so nothing was sent.",
        category: "email",
      };
    case "email_bounced":
      return {
        title: "Email bounced",
        description: text(p.to)
          ? `Could not deliver to ${text(p.to)}. Check the address.`
          : "The recipient address could not receive the email.",
        category: "email",
      };
    case "followup_scheduled": {
      const due = when(p.dueAt);
      return {
        title: "Follow-up scheduled",
        description: due ? `Due ${due}.` : undefined,
        category: "followup",
      };
    }
    case "followup_completed":
      return {
        title: "Follow-up completed",
        description: p.handledBy === "ai" ? "Handled automatically by AI." : undefined,
        category: "followup",
      };
    case "followup_canceled":
      return { title: "Follow-up canceled", category: "followup" };
    case "followup_reopened":
      return { title: "Follow-up reopened", category: "followup" };
    case "meeting_proposed": {
      const starts = when(p.startsAt);
      return {
        title: "Meeting proposed",
        description: starts ? `${text(p.title) ?? "Meeting"} · ${starts}` : text(p.title),
        category: "meeting",
      };
    }
    case "status_changed": {
      const next = text(p.newStatus);
      return {
        title: "Status updated",
        description: next ? `Now marked as ${pretty(next)}.` : undefined,
        category: "status",
      };
    }
    case "lead_assigned": {
      const id = text(p.assignedTo);
      const name = id ? resolveName?.(id) : undefined;
      return {
        title: "Owner assigned",
        description: name ? `Assigned to ${name}.` : "A teammate now owns this lead.",
        category: "status",
      };
    }
    case "lead_unassigned":
      return { title: "Owner removed", description: "This lead is now unassigned.", category: "status" };
    case "manual_takeover":
      return {
        title: "You took over this lead",
        description: "Automated AI follow-ups are paused.",
        category: "control",
      };
    case "ai_resumed":
      return {
        title: "AI control resumed",
        description: "Automated follow-ups are active again.",
        category: "control",
      };
    case "note":
      return {
        title: "Note added",
        description: text(p.note),
        category: "note",
      };
    case "call_logged":
      return {
        title: "Call logged",
        description: text(p.note),
        category: "note",
      };
    default:
      break;
  }

  if (type.startsWith("meeting_")) {
    return {
      title: `Meeting ${pretty(type.slice("meeting_".length))}`,
      category: "meeting",
    };
  }

  return { title: pretty(type), category: "other" };
}

/** Friendly relative time, with an exact timestamp in the title attribute. */
export function activityRelativeTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function activityFullTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

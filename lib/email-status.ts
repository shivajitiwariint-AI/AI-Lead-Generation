export const EMAIL_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Needs approval",
  approved: "Approved",
  sent: "Sent",
  simulated: "Not delivered",
  bounced: "Delivery failed",
  rejected: "Rejected",
  failed: "Failed",
};

export type EmailBadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function emailStatusLabel(status: string): string {
  return (
    EMAIL_STATUS_LABELS[status] ??
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function emailStatusVariant(status: string): EmailBadgeVariant {
  switch (status) {
    case "sent":
      return "default";
    case "approved":
    case "simulated":
      return "secondary";
    case "bounced":
    case "rejected":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

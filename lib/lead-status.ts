export const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "unreviewed", label: "Unreviewed" },
  { value: "qualified", label: "Qualified" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "disqualified", label: "Disqualified" },
] as const;

export function leadStatusLabel(value: string): string {
  return (
    LEAD_STATUS_OPTIONS.find((s) => s.value === value)?.label ??
    value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

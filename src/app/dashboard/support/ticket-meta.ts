import type { TicketStatus, TicketPriority } from "@prisma/client";

export const TICKET_STATUS_META: Record<
  TicketStatus,
  { label: string; className: string }
> = {
  OPEN: { label: "Open", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
  PENDING: { label: "Awaiting you", className: "bg-gold-400/15 text-gold-300 border-gold-400/25" },
  RESOLVED: { label: "Resolved", className: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  CLOSED: { label: "Closed", className: "bg-ink-800 text-fog-400 border-line" },
};

export const TICKET_PRIORITY_META: Record<TicketPriority, { label: string; className: string }> = {
  LOW: { label: "Low", className: "text-fog-400" },
  NORMAL: { label: "Normal", className: "text-fog-300" },
  HIGH: { label: "High", className: "text-gold-300" },
  URGENT: { label: "Urgent", className: "text-rose-300" },
};

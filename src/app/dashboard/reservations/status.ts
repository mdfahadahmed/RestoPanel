import type { BadgeVariant } from "@/lib/admin/format";

export function reservationStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "CONFIRMED": return "emerald";
    case "PENDING": return "amber";
    case "SEATED": return "violet";
    case "COMPLETED": return "sky";
    case "REJECTED":
    case "NO_SHOW":
    case "CANCELLED": return "rose";
    default: return "outline";
  }
}

export const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  REJECTED: "Declined",
  SEATED: "Seated",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};

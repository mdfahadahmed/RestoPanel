import type { OrderStatus } from "@/lib/validations/order";

/**
 * Pure, dependency-free KDS helpers and types. Lives apart from `board.ts` (which
 * touches Prisma) so client components can import these without pulling the DB
 * client into the browser bundle.
 */

export type KdsColumn = "new" | "preparing" | "ready";

/** Statuses that appear on the kitchen board, in pipeline order. */
export const KDS_BOARD_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
];

/** Default target prep time (minutes) when no item carries a prepTime. */
export const DEFAULT_PREP_MINS = 15;

/** Map an order status to its kitchen column, or null if it doesn't belong. */
export function kdsColumnForStatus(status: OrderStatus): KdsColumn | null {
  switch (status) {
    case "PENDING":
    case "CONFIRMED":
      return "new";
    case "PREPARING":
      return "preparing";
    case "READY":
      return "ready";
    default:
      return null;
  }
}

/**
 * Estimate an order's target prep time. The slowest item drives readiness
 * (the kitchen works items in parallel), so we take the max declared
 * `prepTimeMins`, falling back to a sensible default when none is set.
 */
export function estimatePrepMins(items: { prepTimeMins: number | null }[]): number {
  const declared = items
    .map((i) => i.prepTimeMins)
    .filter((m): m is number => typeof m === "number" && m > 0);
  if (declared.length === 0) return DEFAULT_PREP_MINS;
  return Math.max(...declared);
}

export type UrgencyLevel = "ok" | "warn" | "late";

/**
 * How urgent a ticket is, from time elapsed in its current stage vs the target.
 * Drives the ticket colour: warn at/over target, late at 1.5× target.
 */
export function urgencyLevel(elapsedMins: number, targetMins: number): UrgencyLevel {
  const target = targetMins > 0 ? targetMins : DEFAULT_PREP_MINS;
  if (elapsedMins >= target * 1.5) return "late";
  if (elapsedMins >= target) return "warn";
  return "ok";
}

/** A serialized kitchen ticket — no Decimal/Date instances leak to the client. */
export interface KdsTicket {
  id: string;
  orderNumber: string;
  type: string;
  status: OrderStatus;
  customerName: string | null;
  total: number;
  kitchenPriority: boolean;
  notes: string | null;
  createdAt: string; // ISO
  statusSince: string; // ISO — when the order entered its current status
  targetPrepMins: number;
  items: { name: string; quantity: number }[];
}

export interface KdsBoard {
  new: KdsTicket[];
  preparing: KdsTicket[];
  ready: KdsTicket[];
}

/** Priority tickets first, then oldest-first (FIFO) within a column. */
export function compareTickets(a: KdsTicket, b: KdsTicket): number {
  if (a.kitchenPriority !== b.kitchenPriority) return a.kitchenPriority ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}

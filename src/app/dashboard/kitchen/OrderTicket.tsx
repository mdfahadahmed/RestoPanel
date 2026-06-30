"use client";

import { Star, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/validations/order";
import { ORDER_TYPE_LABEL } from "@/app/dashboard/orders/status";
import { urgencyLevel, type KdsColumn, type KdsTicket } from "@/lib/kds/shared";

interface NextAction {
  label: string;
  status: OrderStatus;
}

/** The single forward action a ticket exposes, based on its column + status. */
function nextActionFor(ticket: KdsTicket, column: KdsColumn): NextAction {
  if (column === "new") {
    return ticket.status === "PENDING"
      ? { label: "Accept", status: "CONFIRMED" }
      : { label: "Start", status: "PREPARING" };
  }
  if (column === "preparing") return { label: "Mark ready", status: "READY" };
  // Ready → bump off the board (route delivery vs everything else).
  return ticket.type === "DELIVERY"
    ? { label: "Out for delivery", status: "OUT_FOR_DELIVERY" }
    : { label: "Complete", status: "DELIVERED" };
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const URGENCY_STYLES: Record<
  "ok" | "warn" | "late",
  { card: string; timer: string }
> = {
  ok: { card: "border-line", timer: "text-fog-300" },
  warn: { card: "border-amber-400/40 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]", timer: "text-amber-300" },
  late: {
    card: "border-rose-500/50 shadow-[0_0_0_1px_rgba(244,63,94,0.35)] motion-safe:animate-pulse",
    timer: "text-rose-300",
  },
};

interface OrderTicketProps {
  ticket: KdsTicket;
  column: KdsColumn;
  now: number;
  busy: boolean;
  onAdvance: (id: string, status: OrderStatus) => void;
  onTogglePriority: (id: string, value: boolean) => void;
}

export function OrderTicket({
  ticket,
  column,
  now,
  busy,
  onAdvance,
  onTogglePriority,
}: OrderTicketProps) {
  const sinceMs = now - new Date(ticket.statusSince).getTime();
  const elapsedMins = sinceMs / 60000;
  const urgency = urgencyLevel(elapsedMins, ticket.targetPrepMins);
  const styles = URGENCY_STYLES[urgency];
  const action = nextActionFor(ticket, column);

  return (
    <article
      className={cn(
        "rounded-2xl border bg-ink-900/70 p-4 shadow-soft transition-colors",
        styles.card,
        ticket.kitchenPriority && "ring-1 ring-gold-400/50"
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-fog-100">
              #{ticket.orderNumber}
            </span>
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-fog-300">
              {ORDER_TYPE_LABEL[ticket.type as keyof typeof ORDER_TYPE_LABEL] ?? ticket.type}
            </span>
          </div>
          {ticket.customerName && (
            <p className="mt-0.5 text-sm text-fog-400">{ticket.customerName}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onTogglePriority(ticket.id, !ticket.kitchenPriority)}
          aria-pressed={ticket.kitchenPriority}
          aria-label={ticket.kitchenPriority ? "Remove priority" : "Mark as priority"}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border border-line transition-colors hover:bg-ink-800",
            ticket.kitchenPriority ? "text-gold-300" : "text-fog-500"
          )}
        >
          <Star className={cn("size-5", ticket.kitchenPriority && "fill-current")} />
        </button>
      </header>

      <ul className="mt-3 space-y-1.5">
        {ticket.items.map((item, i) => (
          <li key={i} className="flex items-baseline gap-2 text-base text-fog-100">
            <span className="min-w-7 font-bold text-gold-300">{item.quantity}×</span>
            <span className="leading-snug">{item.name}</span>
          </li>
        ))}
      </ul>

      {ticket.notes && (
        <p className="mt-2 rounded-lg bg-ink-850 px-2.5 py-1.5 text-sm text-fog-300">
          {ticket.notes}
        </p>
      )}

      <footer className="mt-4 flex items-center justify-between gap-3">
        <span className={cn("flex items-center gap-1.5 text-lg font-semibold tabular-nums", styles.timer)}>
          <Clock className="size-4" />
          {formatElapsed(sinceMs)}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAdvance(ticket.id, action.status)}
          className="btn-glow inline-flex h-12 min-w-32 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-violet-400 px-5 text-base font-semibold text-white transition-all hover:from-violet-500 hover:to-violet-500 disabled:pointer-events-none disabled:opacity-50"
        >
          {action.label}
          <ArrowRight className="size-5" />
        </button>
      </footer>
    </article>
  );
}

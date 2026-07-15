import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  MessageSquare,
} from "lucide-react";
import { requireCustomer } from "@/lib/account/context";
import { getOrderForAccount } from "@/lib/account/service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AutoRefresh } from "@/components/store/AutoRefresh";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";
import { ORDER_STATUS_META, ORDER_TYPE_LABEL } from "@/app/dashboard/orders/status";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/validations/order";

export const dynamic = "force-dynamic";

const DELIVERY_STEPS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];
const COLLECTION_STEPS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
];
const TERMINAL_BAD: OrderStatus[] = ["CANCELLED", "REJECTED", "REFUNDED"];

export default async function AccountTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await requireCustomer();
  const { id } = await params;
  const order = await getOrderForAccount(customer.accountId, id);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const steps = order.type === "DELIVERY" ? DELIVERY_STEPS : COLLECTION_STEPS;
  const currentIndex = steps.indexOf(status);
  const isBad = TERMINAL_BAD.includes(status);
  const isActive = !isBad && status !== "DELIVERED";

  const etaMinutes = order.type === "DELIVERY" ? 45 : 25;
  const eta = new Date(order.createdAt.getTime() + etaMinutes * 60_000);

  // Event notes written by the restaurant when advancing the order.
  const restaurantNotes = order.events.filter((e) => e.note && e.note.trim());
  const latestNote = restaurantNotes[restaurantNotes.length - 1];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {isActive && <AutoRefresh />}

      <Link
        href="/account/track"
        className="inline-flex items-center gap-1.5 text-sm text-fog-400 transition hover:text-fog-100"
      >
        <ArrowLeft className="h-4 w-4" /> All tracked orders
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-line bg-ink-900/40 p-6 text-center">
        <p className="text-xs text-fog-500">
          Order #{order.orderNumber} · {order.restaurant.name} ·{" "}
          {ORDER_TYPE_LABEL[order.type]}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fog-100">
          {status === "DELIVERED"
            ? "Delivered 🎉"
            : isBad
              ? ORDER_STATUS_META[status].label
              : ORDER_STATUS_META[status].label}
        </h1>
        <div className="mt-3 inline-flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              isActive ? "animate-pulse bg-emerald-400" : isBad ? "bg-rose-400" : "bg-fog-600"
            )}
          />
          <OrderStatusBadge status={status} />
        </div>
      </div>

      {/* Estimate */}
      {isActive && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-ink-900/40 px-5 py-4 text-sm">
          <Clock className="h-4 w-4 text-fog-400" />
          <span className="text-fog-400">Estimated {order.type === "DELIVERY" ? "delivery" : "ready"} by</span>
          <span className="font-semibold text-fog-100">
            {formatDate(eta, { day: undefined, month: undefined, year: undefined })}
          </span>
        </div>
      )}

      {/* Latest restaurant note */}
      {latestNote && (
        <div className="flex items-start gap-2 rounded-2xl border border-violet-500/20 bg-violet-500/5 px-5 py-4">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <div>
            <p className="text-xs font-medium text-violet-300">Latest update from the restaurant</p>
            <p className="mt-0.5 text-sm text-fog-200">{latestNote.note}</p>
          </div>
        </div>
      )}

      {/* Stepper (hidden for cancelled/refunded) */}
      {!isBad ? (
        <div className="rounded-2xl border border-line bg-ink-900/40 p-6">
          <h2 className="mb-4 text-sm font-semibold text-fog-100">Progress</h2>
          <ol className="space-y-1">
            {steps.map((step, i) => {
              const done = i <= currentIndex;
              const current = i === currentIndex;
              return (
                <li key={step} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle2
                        className={cn(
                          "h-5 w-5",
                          current ? "text-emerald-400" : "text-emerald-500/70"
                        )}
                      />
                    ) : (
                      <Circle className="h-5 w-5 text-fog-600" />
                    )}
                    {i < steps.length - 1 && (
                      <span
                        className={cn(
                          "my-0.5 h-6 w-px",
                          i < currentIndex ? "bg-emerald-500/50" : "bg-line"
                        )}
                      />
                    )}
                  </div>
                  <div className="pb-2">
                    <p
                      className={cn(
                        "text-sm",
                        done ? "font-medium text-fog-100" : "text-fog-500"
                      )}
                    >
                      {ORDER_STATUS_META[step].label}
                    </p>
                    {current && isActive && (
                      <p className="text-xs text-emerald-300">In progress…</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
          <Ban className="h-5 w-5 text-rose-300" />
          <p className="text-sm text-fog-200">
            This order was {ORDER_STATUS_META[status].label.toLowerCase()}.
          </p>
        </div>
      )}

      {/* Full timeline */}
      <div className="rounded-2xl border border-line bg-ink-900/40 p-6">
        <h2 className="mb-4 text-sm font-semibold text-fog-100">History</h2>
        <ol className="relative space-y-4 border-l border-line pl-5">
          {order.events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[1.45rem] top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-400 ring-4 ring-ink-950" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-fog-100">
                  {ORDER_STATUS_META[ev.status as OrderStatus].label}
                </span>
                <span className="text-xs text-fog-500">{formatDate(ev.createdAt)}</span>
              </div>
              {ev.note && <p className="text-xs text-fog-500">{ev.note}</p>}
            </li>
          ))}
        </ol>
      </div>

      {/* Order summary */}
      <div className="rounded-2xl border border-line bg-ink-900/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fog-100">
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </h2>
          <Link
            href={`/account/orders/${order.id}`}
            className="text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            View full order
          </Link>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-fog-400">Total</span>
          <span className="font-semibold text-fog-100">
            {formatCurrency(Number(order.total), order.restaurant.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

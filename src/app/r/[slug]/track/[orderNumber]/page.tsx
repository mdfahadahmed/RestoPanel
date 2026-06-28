import Link from "next/link";
import { CheckCircle2, Clock, MapPin, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { parseItemOptions } from "@/app/dashboard/orders/order-data";
import { ORDER_STATUS_META, PAYMENT_STATUS_META, ORDER_TYPE_LABEL } from "@/app/dashboard/orders/status";
import type { OrderStatus, PaymentStatus } from "@/lib/validations/order";
import { AutoRefresh } from "@/components/store/AutoRefresh";
import { ReviewForm } from "@/components/store/ReviewForm";

export const dynamic = "force-dynamic";

const ACTIVE_STATES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ slug: string; orderNumber: string }>;
}) {
  const { slug, orderNumber } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return <NotFoundCard slug={slug} />;
  }

  const order = await prisma.order.findFirst({
    where: { restaurantId: restaurant.id, orderNumber },
    include: { items: true, events: { orderBy: { createdAt: "asc" } }, review: { select: { id: true } } },
  });

  if (!order) {
    return <NotFoundCard slug={slug} />;
  }

  const status = order.status as OrderStatus;
  const statusMeta = ORDER_STATUS_META[status];
  const isActive = ACTIVE_STATES.includes(status);
  const estimatedReady = new Date(order.createdAt.getTime() + 35 * 60_000);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {isActive && <AutoRefresh />}

      <div className="text-center">
        <p className="text-sm text-fog-400">Order #{order.orderNumber} · {ORDER_TYPE_LABEL[order.type]}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fog-50">
          {status === "DELIVERED" ? "Order complete 🎉" : statusMeta.label}
        </h1>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-ink-900 px-3 py-1 text-sm">
          <span className={`inline-block h-2 w-2 rounded-full ${isActive ? "animate-pulse bg-emerald-400" : "bg-fog-600"}`} />
          <span className="text-fog-300">{statusMeta.label}</span>
        </div>
      </div>

      {/* Estimate + payment */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-ink-900/50 p-5">
          <div className="flex items-center gap-2 text-fog-400"><Clock className="h-4 w-4" /> Estimated ready</div>
          <div className="mt-1 text-xl font-semibold text-fog-100">
            {isActive ? formatDate(estimatedReady, { day: undefined, month: undefined, year: undefined }) : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-ink-900/50 p-5">
          <div className="flex items-center gap-2 text-fog-400"><ShoppingBag className="h-4 w-4" /> Payment</div>
          <div className="mt-1 text-xl font-semibold text-fog-100">
            {PAYMENT_STATUS_META[order.paymentStatus as PaymentStatus].label}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-6 rounded-2xl border border-line bg-ink-900/50 p-6">
        <h2 className="font-semibold text-fog-100">Progress</h2>
        <ol className="relative mt-4 space-y-4 border-l border-line pl-5">
          {order.events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[1.45rem] top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-400 ring-4 ring-ink-950">
                <CheckCircle2 className="h-3 w-3 text-ink-950" />
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-fog-100">{ORDER_STATUS_META[ev.status as OrderStatus].label}</span>
                <span className="text-xs text-fog-500">{formatDate(ev.createdAt)}</span>
              </div>
              {ev.note && <p className="text-xs text-fog-500">{ev.note}</p>}
            </li>
          ))}
        </ol>
      </div>

      {/* Items + total */}
      <div className="mt-6 rounded-2xl border border-line bg-ink-900/50 p-6">
        <h2 className="font-semibold text-fog-100">Your order</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.items.map((item) => {
            const opts = parseItemOptions(item.options);
            return (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="text-fog-300">
                  {item.quantity}× {item.nameSnapshot}
                  {opts.variant && <span className="text-fog-500"> · {opts.variant.name}</span>}
                </span>
                <span className="text-fog-200">{formatCurrency(Number(item.lineTotal))}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between text-fog-400"><span>Subtotal</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
          {Number(order.taxAmount) > 0 && <div className="flex justify-between text-fog-400"><span>Tax</span><span>{formatCurrency(Number(order.taxAmount))}</span></div>}
          {Number(order.deliveryFee) > 0 && <div className="flex justify-between text-fog-400"><span>Delivery</span><span>{formatCurrency(Number(order.deliveryFee))}</span></div>}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-fog-100"><span>Total</span><span>{formatCurrency(Number(order.total))}</span></div>
        </div>
        {order.address && (
          <p className="mt-3 flex items-start gap-2 text-xs text-fog-500"><MapPin className="mt-0.5 h-3.5 w-3.5" /> {order.address}</p>
        )}
      </div>

      {status === "DELIVERED" && !order.review && <ReviewForm slug={slug} orderNumber={order.orderNumber} />}

      <div className="mt-6 text-center">
        <Link href={`/r/${slug}/menu`} className="text-sm text-fog-400 hover:text-fog-100">Order again</Link>
      </div>
    </div>
  );
}

function NotFoundCard({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-fog-50">Order not found</h1>
      <p className="mt-2 text-fog-400">We couldn&apos;t find that order. Check the link and try again.</p>
      <Link href={`/r/${slug}`} className="mt-6 inline-block rounded-full bg-gold-400 px-5 py-2.5 font-medium text-ink-950 hover:bg-gold-300">
        Back to {slug}
      </Link>
    </div>
  );
}

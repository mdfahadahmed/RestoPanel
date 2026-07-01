import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  MapPinned,
  Phone,
  Mail,
  Store,
  User,
  RotateCcw,
} from "lucide-react";
import { requireCustomer } from "@/lib/account/context";
import { getOrderForAccount } from "@/lib/account/service";
import { parseItemOptions } from "@/app/dashboard/orders/order-data";
import {
  ORDER_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/app/dashboard/orders/status";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/account/OrderStatusBadge";
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/validations/order";

export const dynamic = "force-dynamic";

const ACTIVE: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
];

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await requireCustomer();
  const { id } = await params;
  const order = await getOrderForAccount(customer.accountId, id);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const isActive = ACTIVE.includes(status);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1.5 text-sm text-fog-400 transition hover:text-fog-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fog-100">
            Order #{order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-fog-400">
            {ORDER_TYPE_LABEL[order.type]} · {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={status} />
          {isActive && (
            <Link
              href={`/account/track/${order.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-sm text-fog-200 transition hover:bg-ink-800"
            >
              <MapPinned className="h-4 w-4" /> Track
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Restaurant info */}
        <section className="rounded-2xl border border-line bg-ink-900/40 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fog-100">
            <Store className="h-4 w-4 text-fog-400" /> Restaurant
          </h2>
          <p className="text-sm font-medium text-fog-200">{order.restaurant.name}</p>
          {order.restaurant.address && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-fog-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {order.restaurant.address}
            </p>
          )}
          {order.restaurant.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-fog-500">
              <Phone className="h-3.5 w-3.5" /> {order.restaurant.phone}
            </p>
          )}
          <Link
            href={`/r/${order.restaurant.slug}/menu`}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Order again
          </Link>
        </section>

        {/* Customer info */}
        <section className="rounded-2xl border border-line bg-ink-900/40 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fog-100">
            <User className="h-4 w-4 text-fog-400" /> Delivery details
          </h2>
          {order.customerName && (
            <p className="text-sm text-fog-200">{order.customerName}</p>
          )}
          {order.customerPhone && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-fog-500">
              <Phone className="h-3.5 w-3.5" /> {order.customerPhone}
            </p>
          )}
          {order.customerEmail && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-fog-500">
              <Mail className="h-3.5 w-3.5" /> {order.customerEmail}
            </p>
          )}
          {order.address && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-fog-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.address}
            </p>
          )}
          {order.notes && (
            <p className="mt-3 rounded-lg border border-line bg-ink-850 px-3 py-2 text-xs text-fog-400">
              <span className="font-medium text-fog-300">Note:</span> {order.notes}
            </p>
          )}
        </section>
      </div>

      {/* Items */}
      <section className="rounded-2xl border border-line bg-ink-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold text-fog-100">
          Items ({order.items.length})
        </h2>
        <ul className="space-y-4">
          {order.items.map((item) => {
            const opts = parseItemOptions(item.options);
            return (
              <li key={item.id} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fog-100">
                    <span className="text-fog-400">{item.quantity}×</span>{" "}
                    {item.nameSnapshot}
                  </p>
                  {opts.variant && (
                    <p className="mt-0.5 text-xs text-fog-500">
                      Variant: {opts.variant.name}
                      {opts.variant.priceAdjustment
                        ? ` (+${formatCurrency(Number(opts.variant.priceAdjustment))})`
                        : ""}
                    </p>
                  )}
                  {opts.extras.length > 0 && (
                    <p className="mt-0.5 text-xs text-fog-500">
                      Extras:{" "}
                      {opts.extras
                        .map(
                          (e) =>
                            `${e.name}${e.price ? ` (+${formatCurrency(Number(e.price))})` : ""}`
                        )
                        .join(", ")}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-medium text-fog-200">
                  {formatCurrency(Number(item.lineTotal))}
                </p>
              </li>
            );
          })}
        </ul>

        {/* Totals */}
        <div className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
          <Row label="Subtotal" value={formatCurrency(Number(order.subtotal))} />
          {Number(order.discountAmount) > 0 && (
            <Row
              label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}
              value={`− ${formatCurrency(Number(order.discountAmount))}`}
              accent="text-emerald-300"
            />
          )}
          {Number(order.taxAmount) > 0 && (
            <Row
              label={order.restaurant.taxName || "Tax"}
              value={formatCurrency(Number(order.taxAmount))}
            />
          )}
          {Number(order.deliveryFee) > 0 && (
            <Row
              label="Delivery fee"
              value={formatCurrency(Number(order.deliveryFee))}
            />
          )}
          <div className="flex items-center justify-between border-t border-line pt-3 text-base font-semibold text-fog-100">
            <span>Grand total</span>
            <span>{formatCurrency(Number(order.total))}</span>
          </div>
        </div>
      </section>

      {/* Payment */}
      <section className="rounded-2xl border border-line bg-ink-900/40 p-5">
        <h2 className="mb-3 text-sm font-semibold text-fog-100">Payment</h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-fog-500">Method</p>
            <p className="text-fog-200">
              {PAYMENT_METHOD_LABEL[order.paymentMethod as PaymentMethod]}
            </p>
          </div>
          <div>
            <p className="text-xs text-fog-500">Status</p>
            <PaymentStatusBadge status={order.paymentStatus as PaymentStatus} />
          </div>
          {order.invoiceNumber && (
            <div>
              <p className="text-xs text-fog-500">Invoice</p>
              <p className="text-fog-200">{order.invoiceNumber}</p>
            </div>
          )}
        </div>
        {order.paymentStatus === "UNPAID" && order.paymentMethod !== "CASH" && (
          <Link
            href={`/r/${order.restaurant.slug}/pay/${order.id}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-fog-100"
          >
            Complete payment
          </Link>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-fog-400">
      <span>{label}</span>
      <span className={accent ?? "text-fog-300"}>{value}</span>
    </div>
  );
}

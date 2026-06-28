import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Phone, Mail, MapPin, History, ReceiptText } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/validations/order";
import { loadOrder, parseItemOptions } from "../order-data";
import { OrderStatusControl } from "../OrderStatusControl";
import { OrderPaymentControl, OrderNotesEditor } from "../OrderManageControls";
import { OrderPrintMenu } from "../OrderPrintMenu";
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_METHOD_LABEL,
  ORDER_TYPE_LABEL,
} from "../status";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { restaurantId } = await requireTenant();
  const { id } = await params;
  const order = await loadOrder(restaurantId, id);
  if (!order) notFound();

  const statusMeta = ORDER_STATUS_META[order.status as OrderStatus];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order #${order.orderNumber}`}
        description={`Placed ${formatDate(order.createdAt)} · ${ORDER_TYPE_LABEL[order.type]}`}
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/orders">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <OrderPrintMenu id={order.id} />
          </>
        }
      />

      <div className="flex items-center gap-2">
        <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
        <Badge variant={PAYMENT_STATUS_META[order.paymentStatus as PaymentStatus].badge}>
          {PAYMENT_STATUS_META[order.paymentStatus as PaymentStatus].label}
        </Badge>
        <span className="text-xs text-fog-500">
          {PAYMENT_METHOD_LABEL[order.paymentMethod as PaymentMethod]}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: items + totals + notes */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4" /> Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item) => {
                const opts = parseItemOptions(item.options);
                return (
                  <div key={item.id} className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-ink-800 px-1.5 py-0.5 text-xs text-fog-300">
                          ×{item.quantity}
                        </span>
                        <span className="font-medium text-fog-100">{item.nameSnapshot}</span>
                      </div>
                      {opts.variant && (
                        <p className="mt-1 text-xs text-fog-400">
                          Variant: {opts.variant.name}
                          {opts.variant.priceAdjustment ? ` (+${formatCurrency(opts.variant.priceAdjustment)})` : ""}
                        </p>
                      )}
                      {opts.extras.length > 0 && (
                        <p className="mt-0.5 text-xs text-fog-400">
                          Extras: {opts.extras.map((e) => `${e.name} (+${formatCurrency(e.price)})`).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-medium">{formatCurrency(Number(item.lineTotal))}</div>
                      <div className="text-xs text-fog-500">{formatCurrency(Number(item.unitPrice))} each</div>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5 pt-2 text-sm">
                <TotalRow label="Subtotal" value={Number(order.subtotal)} />
                {Number(order.discountAmount) > 0 && (
                  <TotalRow label="Discount" value={-Number(order.discountAmount)} accent="text-emerald-300" />
                )}
                {Number(order.taxAmount) > 0 && <TotalRow label="Tax" value={Number(order.taxAmount)} />}
                {Number(order.deliveryFee) > 0 && <TotalRow label="Delivery fee" value={Number(order.deliveryFee)} />}
                <div className="flex items-center justify-between border-t border-line pt-2 text-base font-semibold">
                  <span>Grand total</span>
                  <span>{formatCurrency(Number(order.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Customer note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-fog-300">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Restaurant notes</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderNotesEditor id={order.id} value={order.restaurantNotes ?? ""} />
            </CardContent>
          </Card>
        </div>

        {/* Right: workflow, payment, customer, timeline */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Status workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderStatusControl id={order.id} status={order.status as OrderStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderPaymentControl
                id={order.id}
                paymentStatus={order.paymentStatus as PaymentStatus}
                paymentMethod={order.paymentMethod as PaymentMethod}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow icon={User} value={order.customerName ?? "Walk-in"} />
              {order.customerPhone && <InfoRow icon={Phone} value={order.customerPhone} />}
              {order.customerEmail && <InfoRow icon={Mail} value={order.customerEmail} />}
              {order.address && <InfoRow icon={MapPin} value={order.address} />}
              {order.customerId && (
                <Button asChild variant="ghost" size="sm" className="mt-1 px-0 text-violet-300 hover:text-violet-200">
                  <Link href={`/dashboard/orders?customer=${order.customerId}`}>
                    <History className="h-3.5 w-3.5" /> Previous orders
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-line pl-4">
                {order.events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[1.32rem] top-1 h-2.5 w-2.5 rounded-full bg-violet-400 ring-4 ring-ink-950" />
                    <div className="flex items-center gap-2">
                      <Badge variant={ORDER_STATUS_META[ev.status as OrderStatus].badge}>
                        {ORDER_STATUS_META[ev.status as OrderStatus].label}
                      </Badge>
                      <span className="text-xs text-fog-500">{formatDate(ev.createdAt)}</span>
                    </div>
                    {ev.note && <p className="mt-1 text-xs text-fog-400">{ev.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-fog-300">
      <span>{label}</span>
      <span className={accent}>{formatCurrency(value)}</span>
    </div>
  );
}

function InfoRow({ icon: Icon, value }: { icon: typeof User; value: string }) {
  return (
    <div className="flex items-center gap-2 text-fog-200">
      <Icon className="h-4 w-4 shrink-0 text-fog-500" />
      <span className="break-words">{value}</span>
    </div>
  );
}

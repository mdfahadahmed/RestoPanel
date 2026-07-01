import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { loadOrder, parseItemOptions, type LoadedOrder } from "@/app/dashboard/orders/order-data";
import { ORDER_TYPE_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_META } from "@/app/dashboard/orders/status";
import type { PaymentMethod, PaymentStatus } from "@/lib/validations/order";
import { PrintAuto } from "@/app/print/PrintAuto";

export const dynamic = "force-dynamic";

const DOCS = ["kitchen", "receipt", "invoice"] as const;
type Doc = (typeof DOCS)[number];

export default async function PrintOrderPage({
  params,
}: {
  params: Promise<{ id: string; doc: string }>;
}) {
  const { restaurantId, restaurantName } = await requireTenant();
  const { id, doc } = await params;
  if (!DOCS.includes(doc as Doc)) notFound();

  const [order, restaurant, payments] = await Promise.all([
    loadOrder(restaurantId, id),
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { name: true, address: true, phone: true, email: true },
    }),
    prisma.payment.findMany({
      where: { restaurantId, orderId: id },
      orderBy: { createdAt: "asc" },
      select: { kind: true, method: true, amount: true, tendered: true, changeGiven: true },
    }),
  ]);
  if (!order) notFound();

  const headerName = restaurant?.name ?? restaurantName;
  const posPayments = payments.map((p) => ({
    kind: p.kind,
    method: p.method,
    amount: Number(p.amount),
    tendered: p.tendered != null ? Number(p.tendered) : null,
    changeGiven: p.changeGiven != null ? Number(p.changeGiven) : null,
  }));

  return (
    <div className="mx-auto max-w-[420px] bg-white px-6 py-8 font-sans text-black print:max-w-none">
      <PrintAuto />
      <style>{`@media print { @page { margin: 12mm; } body { background: #fff; } }`}</style>
      {doc === "kitchen" && <KitchenTicket order={order} restaurantName={headerName} />}
      {doc === "receipt" && <Receipt order={order} restaurantName={headerName} payments={posPayments} />}
      {doc === "invoice" && <Invoice order={order} restaurant={restaurant} restaurantName={headerName} />}

      <p className="mt-8 text-center text-xs text-neutral-500 print:hidden">
        The print dialog opens automatically. You can close this tab afterwards.
      </p>
    </div>
  );
}

function Items({ order, withPrices }: { order: LoadedOrder; withPrices: boolean }) {
  return (
    <div className="divide-y divide-neutral-200 border-y border-neutral-200">
      {order.items.map((item) => {
        const opts = parseItemOptions(item.options);
        return (
          <div key={item.id} className="flex justify-between gap-3 py-2 text-sm">
            <div>
              <div className="font-semibold">
                {item.quantity}× {item.nameSnapshot}
              </div>
              {opts.variant && <div className="text-xs text-neutral-600">{opts.variant.name}</div>}
              {opts.extras.length > 0 && (
                <div className="text-xs text-neutral-600">+ {opts.extras.map((e) => e.name).join(", ")}</div>
              )}
            </div>
            {withPrices && <div className="shrink-0 font-medium">{formatCurrency(Number(item.lineTotal))}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Totals({ order }: { order: LoadedOrder }) {
  return (
    <div className="mt-3 space-y-1 text-sm">
      <Row label="Subtotal" value={Number(order.subtotal)} />
      {Number(order.discountAmount) > 0 && <Row label="Discount" value={-Number(order.discountAmount)} />}
      {Number(order.taxAmount) > 0 && <Row label="Tax" value={Number(order.taxAmount)} />}
      {Number(order.deliveryFee) > 0 && <Row label="Delivery" value={Number(order.deliveryFee)} />}
      <div className="flex justify-between border-t border-neutral-300 pt-1 text-base font-bold">
        <span>Total</span>
        <span>{formatCurrency(Number(order.total))}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-600">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function KitchenTicket({ order, restaurantName }: { order: LoadedOrder; restaurantName: string }) {
  return (
    <div>
      <div className="text-center">
        <h1 className="text-xl font-extrabold uppercase tracking-wide">Kitchen ticket</h1>
        <p className="text-sm text-neutral-600">{restaurantName}</p>
      </div>
      <div className="my-3 flex justify-between text-lg font-bold">
        <span>#{order.orderNumber}</span>
        <span>{ORDER_TYPE_LABEL[order.type]}</span>
      </div>
      <p className="mb-3 text-xs text-neutral-600">{formatDate(order.createdAt)}</p>
      <Items order={order} withPrices={false} />
      {order.notes && (
        <p className="mt-3 rounded border border-neutral-300 p-2 text-sm">
          <span className="font-semibold">Note: </span>
          {order.notes}
        </p>
      )}
    </div>
  );
}

interface ReceiptPayment {
  kind: "SALE" | "REFUND";
  method: PaymentMethod;
  amount: number;
  tendered: number | null;
  changeGiven: number | null;
}

function Receipt({
  order,
  restaurantName,
  payments,
}: {
  order: LoadedOrder;
  restaurantName: string;
  payments: ReceiptPayment[];
}) {
  const change = payments.reduce((s, p) => s + (p.changeGiven ?? 0), 0);
  return (
    <div>
      <div className="text-center">
        <h1 className="text-lg font-extrabold">{restaurantName}</h1>
        <p className="text-xs text-neutral-600">Receipt · #{order.orderNumber}</p>
        <p className="text-xs text-neutral-600">{formatDate(order.createdAt)}</p>
      </div>
      <div className="mt-3">
        <Items order={order} withPrices />
        <Totals order={order} />
      </div>
      <div className="mt-3 space-y-1 text-sm">
        {payments.length > 0 ? (
          payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-neutral-600">
                {p.kind === "REFUND" ? "Refund · " : ""}
                {PAYMENT_METHOD_LABEL[p.method]}
                {p.tendered != null ? ` (given ${formatCurrency(p.tendered)})` : ""}
              </span>
              <span>
                {p.kind === "REFUND" ? "−" : ""}
                {formatCurrency(p.amount)}
              </span>
            </div>
          ))
        ) : (
          <div className="flex justify-between">
            <span className="text-neutral-600">Payment</span>
            <span>
              {PAYMENT_METHOD_LABEL[order.paymentMethod as PaymentMethod]} ·{" "}
              {PAYMENT_STATUS_META[order.paymentStatus as PaymentStatus].label}
            </span>
          </div>
        )}
        {change > 0 && (
          <div className="flex justify-between font-medium">
            <span className="text-neutral-600">Change</span>
            <span>{formatCurrency(change)}</span>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-neutral-600">Thank you for your order!</p>
    </div>
  );
}

function Invoice({
  order,
  restaurant,
  restaurantName,
}: {
  order: LoadedOrder;
  restaurant: { address: string | null; phone: string | null; email: string | null } | null;
  restaurantName: string;
}) {
  return (
    <div className="print:max-w-[640px]">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{restaurantName}</h1>
          {restaurant?.address && <p className="text-xs text-neutral-600">{restaurant.address}</p>}
          {restaurant?.phone && <p className="text-xs text-neutral-600">{restaurant.phone}</p>}
          {restaurant?.email && <p className="text-xs text-neutral-600">{restaurant.email}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold uppercase tracking-wide">Invoice</h2>
          <p className="text-sm">{order.invoiceNumber ?? `#${order.orderNumber}`}</p>
          <p className="text-xs text-neutral-600">Order #{order.orderNumber}</p>
          <p className="text-xs text-neutral-600">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4 rounded border border-neutral-200 p-3 text-sm">
        <p className="font-semibold">Bill to</p>
        <p>{order.customerName ?? "Walk-in customer"}</p>
        {order.customerPhone && <p className="text-neutral-600">{order.customerPhone}</p>}
        {order.customerEmail && <p className="text-neutral-600">{order.customerEmail}</p>}
        {order.address && <p className="text-neutral-600">{order.address}</p>}
      </div>

      <div className="mt-4">
        <Items order={order} withPrices />
        <Totals order={order} />
      </div>

      <div className="mt-4 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-600">Payment method</span>
          <span>{PAYMENT_METHOD_LABEL[order.paymentMethod as PaymentMethod]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600">Payment status</span>
          <span>{PAYMENT_STATUS_META[order.paymentStatus as PaymentStatus].label}</span>
        </div>
      </div>
    </div>
  );
}

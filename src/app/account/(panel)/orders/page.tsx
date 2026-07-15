import Link from "next/link";
import { Eye, MapPinned, RotateCcw, ShoppingBag } from "lucide-react";
import { requireCustomer } from "@/lib/account/context";
import { listOrders, listOrderedRestaurants } from "@/lib/account/service";
import { orderListQuerySchema } from "@/lib/validations/account";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { OrdersFilterBar } from "@/components/account/OrdersFilterBar";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/account/OrderStatusBadge";
import { ORDER_TYPE_LABEL } from "@/app/dashboard/orders/status";
import type { OrderStatus, PaymentStatus } from "@/lib/validations/order";

export const dynamic = "force-dynamic";

const ACTIVE: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
];

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const customer = await requireCustomer();
  const sp = await searchParams;
  const query = orderListQuerySchema.parse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
    restaurantId: typeof sp.restaurantId === "string" ? sp.restaurantId : undefined,
    sort: typeof sp.sort === "string" ? sp.sort : undefined,
    page: typeof sp.page === "string" ? sp.page : undefined,
  });

  const [result, restaurants] = await Promise.all([
    listOrders(customer.accountId, query),
    listOrderedRestaurants(customer.accountId),
  ]);
  const { orders, total, page, pageCount } = result;

  function pageHref(p: number) {
    const s = new URLSearchParams();
    if (query.q) s.set("q", query.q);
    if (query.status) s.set("status", query.status);
    if (query.restaurantId) s.set("restaurantId", query.restaurantId);
    if (query.sort) s.set("sort", query.sort);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return qs ? `/account/orders?${qs}` : "/account/orders";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">
          My Orders
        </h1>
        <p className="mt-1 text-sm text-fog-400">
          {total} order{total === 1 ? "" : "s"} across your restaurants.
        </p>
      </div>

      <OrdersFilterBar restaurants={restaurants} />

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders found"
          description="Try clearing your filters, or place an order from one of your favourite restaurants."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
            <table className="w-full text-sm">
              <thead className="bg-ink-900/60 text-left text-xs uppercase tracking-wider text-fog-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Restaurant</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="transition hover:bg-ink-800/30">
                    <td className="px-4 py-3 font-medium text-fog-100">
                      #{o.orderNumber}
                      <span className="ml-2 text-xs text-fog-500">
                        {ORDER_TYPE_LABEL[o.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-fog-300">{o.restaurant.name}</td>
                    <td className="px-4 py-3 text-fog-400">
                      {formatDate(o.createdAt, { hour: undefined, minute: undefined })}
                    </td>
                    <td className="px-4 py-3 text-fog-400">{o._count.items}</td>
                    <td className="px-4 py-3 font-semibold text-fog-100">
                      {formatCurrency(Number(o.total), o.restaurant.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={o.paymentStatus as PaymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status as OrderStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {ACTIVE.includes(o.status as OrderStatus) && (
                          <Link
                            href={`/account/track/${o.id}`}
                            aria-label="Track order"
                            className="grid h-8 w-8 place-items-center rounded-lg border border-line text-fog-400 transition hover:bg-ink-800 hover:text-fog-100"
                          >
                            <MapPinned className="h-4 w-4" />
                          </Link>
                        )}
                        <Link
                          href={`/r/${o.restaurant.slug}/menu`}
                          aria-label="Reorder"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-fog-400 transition hover:bg-ink-800 hover:text-fog-100"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/account/orders/${o.id}`}
                          aria-label="View order"
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-fog-400 transition hover:bg-ink-800 hover:text-fog-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.id}`}
                className="block rounded-2xl border border-line bg-ink-900/40 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-fog-100">#{o.orderNumber}</p>
                  <OrderStatusBadge status={o.status as OrderStatus} />
                </div>
                <p className="mt-1 text-sm text-fog-300">{o.restaurant.name}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-fog-500">
                  <span>
                    {formatDate(o.createdAt, { hour: undefined, minute: undefined })} ·{" "}
                    {o._count.items} item{o._count.items === 1 ? "" : "s"}
                  </span>
                  <span className="text-sm font-semibold text-fog-100">
                    {formatCurrency(Number(o.total), o.restaurant.currency)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-fog-500">
                Page {page} of {pageCount}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-fog-300 transition hover:bg-ink-800"
                  >
                    Previous
                  </Link>
                )}
                {page < pageCount && (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-fog-300 transition hover:bg-ink-800"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { ChevronRight, MapPinned, PackageCheck } from "lucide-react";
import { requireCustomer } from "@/lib/account/context";
import { getActiveOrders } from "@/lib/account/service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";
import { AutoRefresh } from "@/components/store/AutoRefresh";
import { ORDER_TYPE_LABEL } from "@/app/dashboard/orders/status";
import type { OrderStatus } from "@/lib/validations/order";

export const dynamic = "force-dynamic";

export default async function AccountTrackListPage() {
  const customer = await requireCustomer();
  const orders = await getActiveOrders(customer.accountId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {orders.length > 0 && <AutoRefresh />}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">
          Track Order
        </h1>
        <p className="mt-1 text-sm text-fog-400">
          Live status of your in-progress orders. This page updates automatically.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Nothing in progress"
          description="You have no active orders right now. Your completed orders are in My Orders."
          action={
            <Link
              href="/account/orders"
              className="rounded-xl border border-line bg-ink-900 px-4 py-2 text-sm text-fog-200 transition hover:bg-ink-800"
            >
              View order history
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/track/${o.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-ink-900/40 p-4 transition hover:bg-ink-800/40"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-300">
                  <MapPinned className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-fog-100">
                      #{o.orderNumber} · {o.restaurant.name}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fog-500">
                    {ORDER_TYPE_LABEL[o.type]} · {formatCurrency(Number(o.total))} ·{" "}
                    {formatDate(o.createdAt)}
                  </p>
                </div>
                <OrderStatusBadge status={o.status as OrderStatus} />
                <ChevronRight className="h-4 w-4 shrink-0 text-fog-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

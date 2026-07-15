import Link from "next/link";
import { ArrowRight, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { requireCustomer } from "@/lib/account/context";
import { getDashboardData } from "@/lib/account/service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardStats } from "@/components/account/DashboardStats";
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge";
import type { OrderStatus } from "@/lib/validations/order";

export const dynamic = "force-dynamic";

export default async function AccountDashboardPage() {
  const customer = await requireCustomer();
  const data = await getDashboardData(customer.accountId);
  const firstName = customer.name.split(" ")[0] || customer.name;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Welcome card */}
      <section className="glass relative overflow-hidden rounded-2xl p-6 shadow-soft sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" />
        <div className="relative">
          <p className="text-sm text-fog-400">Welcome back,</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fog-100 sm:text-3xl">
            {firstName} 👋
          </h1>
          <p className="mt-2 max-w-lg text-sm text-fog-400">
            Track your orders, manage addresses and reorder your favourites — all
            in one place.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/account/orders"
              className="btn-glow inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100"
            >
              <ShoppingBag className="h-4 w-4" /> View orders
            </Link>
            <Link
              href="/account/favorites"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-4 py-2.5 text-sm font-medium text-fog-200 transition hover:bg-ink-800"
            >
              <UtensilsCrossed className="h-4 w-4" /> Order favourites
            </Link>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <DashboardStats
        total={data.total}
        active={data.active}
        completed={data.completed}
        cancelled={data.cancelled}
        loyaltyPoints={data.loyaltyPoints}
      />

      {/* Recent orders */}
      <section className="rounded-2xl border border-line bg-ink-900/40">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold text-fog-100">Recent orders</h2>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1 text-sm text-fog-400 transition hover:text-fog-100"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {data.recent.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ShoppingBag}
              title="No orders yet"
              description="When you place an order from a RestoPanel restaurant, it'll show up here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${o.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-ink-800/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-ink-850 text-fog-400">
                    <ShoppingBag className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fog-100">
                      #{o.orderNumber} · {o.restaurant.name}
                    </p>
                    <p className="truncate text-xs text-fog-500">
                      {o._count.items} item{o._count.items === 1 ? "" : "s"} ·{" "}
                      {formatDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <OrderStatusBadge status={o.status as OrderStatus} />
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-fog-100">
                    {formatCurrency(Number(o.total), o.restaurant.currency)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

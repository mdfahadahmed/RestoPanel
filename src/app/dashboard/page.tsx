import Link from "next/link";
import {
  ShoppingBag,
  Banknote,
  Clock,
  UserPlus,
  TrendingUp,
  PackageX,
  Activity,
  ArrowRight,
} from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ORDER_STATUS_META } from "@/app/dashboard/orders/status";
import type { OrderStatus } from "@/lib/validations/order";
import { getDashboardHome } from "./home-data";

export const dynamic = "force-dynamic";

export default async function DashboardOverview() {
  const tenant = await requireTenant();
  const data = await getDashboardHome(tenant.restaurantId);
  const money = (n: number) => formatCurrency(n, data?.currency ?? "GBP");
  const maxRevenue = Math.max(1, ...(data?.revenue7d.map((d) => d.revenue) ?? [1]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back 👋</h1>
        <p className="mt-1 text-sm text-fog-400">
          Here&apos;s what&apos;s happening at {tenant.restaurantName} today.
        </p>
      </div>

      {data === null ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
          Connect a database to see live data. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
        </div>
      ) : (
        <>
          {/* Today's summary ------------------------------------------------ */}
          <section aria-labelledby="today-heading" className="space-y-3">
            <h2 id="today-heading" className="sr-only">
              Today&apos;s summary
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Orders today" value={data.today.orders} icon={ShoppingBag} accent="text-fog-100" />
              <StatCard label="Revenue today" value={money(data.today.revenue)} icon={Banknote} accent="text-emerald-300" />
              <StatCard label="Pending orders" value={data.today.pending} icon={Clock} accent="text-amber-300" hint="Awaiting action" />
              <StatCard label="New customers" value={data.today.newCustomers} icon={UserPlus} accent="text-violet-300" />
            </div>
          </section>

          {/* Quick actions -------------------------------------------------- */}
          <section aria-labelledby="qa-heading" className="space-y-3">
            <h2 id="qa-heading" className="text-sm font-medium text-fog-300">
              Quick actions
            </h2>
            <QuickActions />
          </section>

          {/* Revenue + top selling ----------------------------------------- */}
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Widget title="Revenue (last 7 days)" icon={TrendingUp} href="/dashboard/analytics" linkLabel="Analytics">
              <div className="flex h-44 items-end gap-2" role="img" aria-label="Daily revenue for the last 7 days">
                {data.revenue7d.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-violet-500/30 to-violet-400/80 transition-[height]"
                        style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
                        title={`${d.label}: ${money(d.revenue)}`}
                      />
                    </div>
                    <span className="text-[11px] text-fog-500">{d.label}</span>
                  </div>
                ))}
              </div>
            </Widget>

            <Widget title="Top selling" icon={TrendingUp} href="/dashboard/products" linkLabel="Products">
              {data.topSelling.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No sales yet" description="Top products from the last 30 days appear here." className="py-10" />
              ) : (
                <ul className="space-y-2.5">
                  {data.topSelling.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-3 text-sm">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-ink-800 text-xs font-semibold text-fog-400">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-fog-100">{p.name}</span>
                      <span className="shrink-0 text-fog-400">{p.qty} sold</span>
                      <span className="w-16 shrink-0 text-right font-medium text-emerald-300">{money(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Widget>
          </div>

          {/* Low stock + recent activity ----------------------------------- */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Widget title="Low stock" icon={PackageX} href="/dashboard/products" linkLabel="Manage">
              {data.lowStock.length === 0 ? (
                <EmptyState icon={PackageX} title="Everything's stocked" description="Products running low will be flagged here." className="py-10" />
              ) : (
                <ul className="space-y-2.5">
                  {data.lowStock.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-fog-100">{p.name}</span>
                      {p.stockQuantity != null && <span className="shrink-0 text-fog-400">{p.stockQuantity} left</span>}
                      <Badge variant={p.status === "OUT_OF_STOCK" ? "rose" : "amber"}>
                        {p.status === "OUT_OF_STOCK" ? "Out" : "Low"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Widget>

            <Widget title="Recent activity" icon={Activity}>
              {data.activity.length === 0 ? (
                <EmptyState icon={Activity} title="No activity yet" description="Order updates will show up here." className="py-10" />
              ) : (
                <ul className="space-y-3">
                  {data.activity.map((a) => {
                    const meta = ORDER_STATUS_META[a.status as OrderStatus];
                    return (
                      <li key={a.id} className="flex items-center gap-3 text-sm">
                        <Badge variant={meta?.badge ?? "outline"}>{meta?.label ?? a.status}</Badge>
                        <Link href="/dashboard/orders" className="min-w-0 flex-1 truncate text-fog-200 hover:text-fog-100">
                          Order #{a.orderNumber}
                        </Link>
                        <span className="shrink-0 text-xs text-fog-500">
                          <RelativeTime iso={a.createdAt} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Widget>
          </div>
        </>
      )}
    </div>
  );
}

/** Consistent dashboard card with a titled header + optional "view all" link. */
function Widget({
  title,
  icon: Icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: import("lucide-react").LucideIcon;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-ink-900/50 p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Icon className="size-4 text-fog-500" />
          {title}
        </h3>
        {href && linkLabel && (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            {linkLabel}
            <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Server-rendered relative timestamp (e.g. "3m ago"). */
function RelativeTime({ iso }: { iso: string }) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  let label: string;
  if (mins < 1) label = "just now";
  else if (mins < 60) label = `${mins}m ago`;
  else if (mins < 1440) label = `${Math.floor(mins / 60)}h ago`;
  else label = `${Math.floor(mins / 1440)}d ago`;
  return <time dateTime={iso}>{label}</time>;
}

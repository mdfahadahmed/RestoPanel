import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Stats {
  orders: number;
  pending: number;
  products: number;
  customers: number;
}

async function getStats(restaurantId: string): Promise<Stats | null> {
  try {
    const [orders, pending, products, customers] = await Promise.all([
      prisma.order.count({ where: { restaurantId } }),
      prisma.order.count({ where: { restaurantId, status: "PENDING" } }),
      prisma.product.count({ where: { restaurantId } }),
      prisma.customer.count({ where: { restaurantId } }),
    ]);
    return { orders, pending, products, customers };
  } catch {
    // DB not reachable yet (e.g. DATABASE_URL not configured) — show a setup hint.
    return null;
  }
}

export default async function DashboardOverview() {
  const tenant = await requireTenant();
  const stats = await getStats(tenant.restaurantId);

  const cards = [
    { label: "Total orders", value: stats?.orders ?? 0, accent: "text-fog-100" },
    { label: "Pending orders", value: stats?.pending ?? 0, accent: "text-amber-300" },
    { label: "Products", value: stats?.products ?? 0, accent: "text-violet-300" },
    { label: "Customers", value: stats?.customers ?? 0, accent: "text-emerald-300" },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back 👋
        </h1>
        <p className="mt-1 text-sm text-fog-400">
          Here&apos;s what&apos;s happening at {tenant.restaurantName} today.
        </p>
      </div>

      {stats === null && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
          Connect a database to see live data. Set <code>DATABASE_URL</code> and run{" "}
          <code>npm run db:migrate</code>.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-line bg-ink-900/50 p-5"
          >
            <div className="text-xs text-fog-400">{c.label}</div>
            <div className={`mt-2 text-3xl font-semibold ${c.accent}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-line bg-ink-900/50 p-6">
          <h2 className="text-sm font-medium">Revenue (last 7 days)</h2>
          <div className="mt-5 flex h-40 items-end gap-2">
            {[20, 35, 28, 50, 42, 60, 48].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-violet-500/30 to-violet-400/80"
                style={{ height: `${Math.max(h, 8)}%` }}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-fog-500">
            See full sales trends, best sellers and more in{" "}
            <Link href="/dashboard/analytics" className="text-violet-300 hover:text-violet-200">
              Analytics
            </Link>
            .
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-ink-900/50 p-6">
          <h2 className="text-sm font-medium">Next steps</h2>
          <ul className="mt-4 space-y-3 text-sm text-fog-300">
            <li className="flex items-start gap-2">
              <span className="text-violet-400">①</span> Add your menu categories
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-400">②</span> Upload your products
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-400">③</span> Share your ordering site
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-400">④</span> Configure SMS notifications
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

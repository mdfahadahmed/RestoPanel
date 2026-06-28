import { Wallet, ClipboardList, Users, TrendingUp, Repeat } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import { parseDateParam } from "@/lib/date-range";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { AnalyticsFilters } from "./AnalyticsFilters";
import { BarChart, HBarList } from "./Charts";
import { getAnalytics } from "./data";

export const dynamic = "force-dynamic";

function resolveRange(sp: Record<string, string | undefined>): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const range = sp.range ?? "7d";
  if (range === "custom") {
    const from = parseDateParam(sp.from) ?? new Date(startToday.getTime() - 29 * 86_400_000);
    const customTo = parseDateParam(sp.to, true) ?? now;
    return { from, to: customTo };
  }
  if (range === "today") return { from: startToday, to };
  if (range === "30d") return { from: new Date(startToday.getTime() - 29 * 86_400_000), to };
  return { from: new Date(startToday.getTime() - 6 * 86_400_000), to }; // 7d default
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { restaurantId } = await requireTenant();
  const sp = await searchParams;
  const { from, to } = resolveRange(sp);
  const data = await getAnalytics(restaurantId, from, to);

  return (
    <GsapReveal className="space-y-6">
      <PageHeader title="Analytics" description="Sales performance, trends and product insights." />

      <AnalyticsFilters />

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Revenue" value={formatCurrency(data.revenue)} icon={Wallet} accent="text-emerald-300" />
        <StatCard label="Orders" value={data.orders} icon={ClipboardList} />
        <StatCard label="New customers" value={data.newCustomers} icon={Users} accent="text-sky-300" />
        <StatCard label="Avg. order value" value={formatCurrency(data.avgOrderValue)} icon={TrendingUp} accent="text-violet-300" />
        <StatCard label="Returning customers" value={data.returningCustomers} icon={Repeat} accent="text-gold-300" />
      </div>

      {/* Revenue charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Daily revenue" data={data.daily.map((d) => ({ label: d.label, value: d.revenue }))} color="violet" format={formatCurrency} />
        <BarChart title="Orders trend" data={data.ordersTrend.map((d) => ({ label: d.label, value: d.orders }))} color="sky" format={(n) => String(n)} />
        <BarChart title="Weekly revenue (8 weeks)" data={data.weekly.map((d) => ({ label: d.label, value: d.revenue }))} color="emerald" format={formatCurrency} />
        <BarChart title="Monthly revenue (6 months)" data={data.monthly.map((d) => ({ label: d.label, value: d.revenue }))} color="gold" format={formatCurrency} />
      </div>

      {/* Product insights */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HBarList
          title="Best selling products"
          rows={data.bestSellers.map((b) => ({ name: b.name, value: b.quantity, sub: formatCurrency(b.revenue) }))}
          format={(n) => `${n} sold`}
        />
        <HBarList
          title="Category sales"
          rows={data.categorySales.map((c) => ({ name: c.name, value: c.revenue }))}
          format={formatCurrency}
        />
      </div>
    </GsapReveal>
  );
}

import { TrendingUp, Store, UserMinus, Repeat } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart, HBarList } from "@/app/dashboard/analytics/Charts";
import {
  getPlatformOverview,
  getPlatformSeries,
  getChurnBreakdown,
} from "@/lib/admin/metrics";
import { formatMoney, formatNumber } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [o, series, churn] = await Promise.all([
    getPlatformOverview(),
    getPlatformSeries(),
    getChurnBreakdown(),
  ]);

  return (
    <>
      <PageHeader
        title="Platform Analytics"
        description="Revenue, growth, churn and active-restaurant trends."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="MRR" value={formatMoney(o.mrr)} icon={TrendingUp} accent="text-gold-300" />
        <StatCard label="ARR" value={formatMoney(o.arr)} icon={TrendingUp} accent="text-gold-300" />
        <StatCard label="Active Restaurants" value={formatNumber(o.activeRestaurants)} icon={Store} accent="text-emerald-300" />
        <StatCard label="Churn (30d)" value={`${churn.churnRate}%`} icon={UserMinus} accent="text-rose-300" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Revenue (12 mo)" data={series.revenue} color="gold" format={(n) => formatMoney(n)} />
        <BarChart title="Restaurant Growth (12 mo)" data={series.restaurantGrowth} color="violet" format={(n) => `${n}`} />
        <BarChart title="User Growth (12 mo)" data={series.userGrowth} color="sky" format={(n) => `${n}`} />
        <HBarList
          title="Subscription health"
          format={(n) => formatNumber(n)}
          rows={[
            { name: "Active", value: churn.activeSubscriptions },
            { name: "Trialing", value: o.trialUsers },
            { name: "New (30d)", value: churn.newSubsLast30 },
            { name: "Canceled (30d)", value: churn.canceledLast30 },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="New subs (30d)" value={formatNumber(churn.newSubsLast30)} icon={Repeat} />
        <StatCard label="Canceled (30d)" value={formatNumber(churn.canceledLast30)} icon={UserMinus} />
        <StatCard label="Total restaurants" value={formatNumber(o.totalRestaurants)} icon={Store} />
        <StatCard label="Total revenue" value={formatMoney(o.totalRevenue)} icon={TrendingUp} accent="text-gold-300" />
      </div>
    </>
  );
}

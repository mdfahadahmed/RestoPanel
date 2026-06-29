import {
  Store,
  CheckCircle2,
  PauseCircle,
  Users,
  PoundSterling,
  TrendingUp,
  CalendarClock,
  UserPlus,
  Hourglass,
  LifeBuoy,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { BarChart } from "@/app/dashboard/analytics/Charts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getPlatformOverview, getPlatformSeries } from "@/lib/admin/metrics";
import { formatMoney, formatNumber } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [o, series] = await Promise.all([
    getPlatformOverview(),
    getPlatformSeries(),
  ]);

  return (
    <>
      <PageHeader
        title="Platform Dashboard"
        description="Live overview of every restaurant, subscription and pound flowing through RestoPanel."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total Restaurants" value={formatNumber(o.totalRestaurants)} icon={Store} />
        <StatCard
          label="Active"
          value={formatNumber(o.activeRestaurants)}
          icon={CheckCircle2}
          accent="text-emerald-300"
        />
        <StatCard
          label="Suspended"
          value={formatNumber(o.suspendedRestaurants)}
          icon={PauseCircle}
          accent="text-rose-300"
        />
        <StatCard label="Total Users" value={formatNumber(o.totalUsers)} icon={Users} />
        <StatCard
          label="Monthly Revenue"
          value={formatMoney(o.monthlyRevenue)}
          icon={PoundSterling}
          accent="text-gold-300"
          hint="Paid invoices this month"
        />
        <StatCard
          label="MRR"
          value={formatMoney(o.mrr)}
          icon={TrendingUp}
          accent="text-gold-300"
          hint="Monthly recurring revenue"
        />
        <StatCard
          label="ARR"
          value={formatMoney(o.arr)}
          icon={CalendarClock}
          accent="text-gold-300"
          hint="Annual run rate"
        />
        <StatCard label="New Signups" value={formatNumber(o.newSignups)} icon={UserPlus} hint="Last 30 days" />
        <StatCard label="Trial Users" value={formatNumber(o.trialUsers)} icon={Hourglass} accent="text-sky-300" />
        <StatCard
          label="Expiring Soon"
          value={formatNumber(o.expiringSubscriptions)}
          icon={CalendarClock}
          accent="text-amber-300"
          hint="Renews within 7 days"
        />
        <StatCard label="Open Tickets" value={formatNumber(o.openTickets)} icon={LifeBuoy} accent="text-sky-300" />
        <StatCard label="Churn (30d)" value={`${o.churnRate}%`} icon={TrendingUp} accent="text-rose-300" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <BarChart
            title="Revenue"
            data={series.revenue}
            color="gold"
            format={(n) => formatMoney(n)}
          />
        </div>
        <div className="xl:col-span-1">
          <BarChart
            title="Restaurant Growth"
            data={series.restaurantGrowth}
            color="violet"
            format={(n) => `${n} new`}
          />
        </div>
        <div className="xl:col-span-1">
          <BarChart
            title="User Growth"
            data={series.userGrowth}
            color="sky"
            format={(n) => `${n} new`}
          />
        </div>
      </div>
    </>
  );
}

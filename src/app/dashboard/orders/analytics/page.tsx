import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default async function OrderAnalyticsPage() {
  const { restaurantId } = await requireTenant();

  const today = startOfDay(new Date());
  const since = addDays(today, -29); // 30-day window (incl. today)

  // Paid orders drive revenue analytics.
  const orders = await prisma.order.findMany({
    where: { restaurantId, paymentStatus: "PAID", createdAt: { gte: since } },
    select: { total: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Bucket revenue + counts per day.
  const days: { date: Date; label: string; revenue: number; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const date = addDays(since, i);
    days.push({
      date,
      label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      revenue: 0,
      count: 0,
    });
  }
  for (const o of orders) {
    const idx = Math.floor((startOfDay(o.createdAt).getTime() - since.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days.length) {
      days[idx].revenue += Number(o.total);
      days[idx].count += 1;
    }
  }

  const sumRange = (n: number) => {
    const slice = days.slice(days.length - n);
    return {
      revenue: slice.reduce((s, d) => s + d.revenue, 0),
      count: slice.reduce((s, d) => s + d.count, 0),
    };
  };
  const todayStats = sumRange(1);
  const last7 = sumRange(7);
  const prev7 = { revenue: 0, count: 0 };
  for (const d of days.slice(days.length - 14, days.length - 7)) {
    prev7.revenue += d.revenue;
    prev7.count += d.count;
  }
  const last30 = sumRange(30);

  const weekTrend = prev7.revenue === 0 ? (last7.revenue > 0 ? 100 : 0) : ((last7.revenue - prev7.revenue) / prev7.revenue) * 100;

  const last14 = days.slice(days.length - 14);
  const maxRevenue = Math.max(1, ...last14.map((d) => d.revenue));
  const maxCount = Math.max(1, ...last14.map((d) => d.count));

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Order analytics"
        description="Sales performance and order trends over the last 30 days."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">
              <ArrowLeft className="h-4 w-4" /> Back to orders
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={formatCurrency(todayStats.revenue)} hint={`${todayStats.count} orders`} accent="text-sky-300" />
        <StatCard label="Last 7 days" value={formatCurrency(last7.revenue)} hint={`${last7.count} orders`} accent="text-emerald-300" />
        <StatCard label="Last 30 days" value={formatCurrency(last30.revenue)} hint={`${last30.count} orders`} accent="text-violet-300" />
        <Card className="p-4 sm:p-5">
          <div className="text-xs text-fog-400">Week-over-week</div>
          <div className={`mt-2 flex items-center gap-1.5 text-2xl font-semibold sm:text-3xl ${weekTrend >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {weekTrend >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {Math.abs(weekTrend).toFixed(0)}%
          </div>
          <p className="mt-1 text-xs text-fog-500">vs. previous 7 days</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily revenue (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-end gap-1.5">
            {last14.map((d) => (
              <div key={d.label} className="group flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-violet-500/30 to-violet-400/80 transition-all"
                    style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%` }}
                    title={`${d.label}: ${formatCurrency(d.revenue)}`}
                  />
                </div>
                <span className="text-[9px] text-fog-500">{d.label.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders per day (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-36 items-end gap-1.5">
            {last14.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-sky-500/30 to-sky-400/80"
                    style={{ height: `${Math.max(2, (d.count / maxCount) * 100)}%` }}
                    title={`${d.label}: ${d.count} orders`}
                  />
                </div>
                <span className="text-[9px] text-fog-500">{d.label.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </GsapReveal>
  );
}

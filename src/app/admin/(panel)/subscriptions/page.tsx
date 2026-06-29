import Link from "next/link";
import { CreditCard, Star } from "lucide-react";
import type { SubscriptionStatus } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ParamTabs } from "@/components/admin/ParamTabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listSubscriptions, listPlans } from "@/lib/admin/subscriptions";
import {
  formatDate,
  formatMoney2,
  formatNumber,
  subscriptionStatusVariant,
} from "@/lib/admin/format";
import { SubscriptionRowActions } from "./SubscriptionRowActions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Trialing", value: "TRIALING" },
  { label: "Past due", value: "PAST_DUE" },
  { label: "Canceled", value: "CANCELED" },
];

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (sp.status as SubscriptionStatus | "ALL") ?? "ALL";

  const [{ rows, total, pageCount, perPage }, plans] = await Promise.all([
    listSubscriptions({ status, page }),
    listPlans(),
  ]);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Plans and where every restaurant sits on them."
      />

      {/* Plans overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.id} className="relative">
            {p.isFeatured && (
              <span className="absolute right-3 top-3">
                <Star className="h-4 w-4 text-gold-300" />
              </span>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                {p.name}
                {!p.isActive && <Badge variant="outline">inactive</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gold-300">
                {formatMoney2(Number(p.priceMonthly), p.currency)}
                <span className="text-sm font-normal text-fog-500">/mo</span>
              </div>
              <p className="mt-1 text-xs text-fog-500">
                {formatNumber(p._count.subscriptions)} subscriber
                {p._count.subscriptions === 1 ? "" : "s"} · {p.trialDays}d trial
              </p>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && (
          <Card>
            <CardContent className="py-6 text-sm text-fog-500">
              No plans yet. Seed plans to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fog-300">
          Subscriptions ({formatNumber(total)})
        </h2>
        <ParamTabs paramKey="status" options={STATUS_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CreditCard} title="No subscriptions" description="No subscriptions match this filter." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Renews</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/admin/restaurants/${s.restaurant.id}`}
                      className="font-medium text-fog-100 hover:text-violet-300"
                    >
                      {s.restaurant.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-fog-200">{s.plan.name}</TableCell>
                  <TableCell className="text-xs text-fog-400">
                    {s.billingCycle.toLowerCase()}
                  </TableCell>
                  <TableCell>{formatMoney2(Number(s.amount))}</TableCell>
                  <TableCell>
                    <Badge variant={subscriptionStatusVariant(s.status)}>
                      {s.status.toLowerCase().replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-fog-400">
                    {formatDate(s.currentPeriodEnd)}
                  </TableCell>
                  <TableCell className="text-right">
                    <SubscriptionRowActions id={s.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={pageCount} totalItems={total} pageSize={perPage} />
        </Card>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  Star,
  FolderTree,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRestaurantDetail } from "@/lib/admin/restaurants";
import {
  formatDate,
  formatMoney2,
  formatNumber,
  invoiceStatusVariant,
  restaurantStatusVariant,
  subscriptionStatusVariant,
} from "@/lib/admin/format";
import { RestaurantRowActions } from "../RestaurantRowActions";

export const dynamic = "force-dynamic";

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRestaurantDetail(id);
  if (!r) notFound();

  const owner = r.users.find((u) => u.role === "OWNER") ?? r.users[0];

  return (
    <>
      <Link
        href="/admin/restaurants"
        className="inline-flex items-center gap-1.5 text-sm text-fog-400 hover:text-fog-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to restaurants
      </Link>

      <PageHeader
        title={r.name}
        description={`/${r.slug}`}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={restaurantStatusVariant(r.status)}>
              {r.status.toLowerCase()}
            </Badge>
            <RestaurantRowActions id={r.id} name={r.name} status={r.status} />
          </div>
        }
      />

      {r.status === "SUSPENDED" && r.suspendedReason && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Suspended {r.suspendedAt ? `on ${formatDate(r.suspendedAt)}` : ""}: {r.suspendedReason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Orders" value={formatNumber(r._count.orders)} icon={ShoppingBag} />
        <StatCard label="Products" value={formatNumber(r._count.products)} icon={UtensilsCrossed} />
        <StatCard label="Customers" value={formatNumber(r._count.customers)} icon={Users} />
        <StatCard label="Categories" value={formatNumber(r._count.categories)} icon={FolderTree} />
        <StatCard label="Reviews" value={formatNumber(r._count.reviews)} icon={Star} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Owner / contact */}
        <Card>
          <CardHeader>
            <CardTitle>Owner & contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Owner" value={r.ownerName} />
            <Row label="Account email" value={owner?.email ?? "—"} />
            <Row label="Public email" value={r.email ?? "—"} />
            <Row label="Phone" value={r.phone ?? "—"} />
            <Row label="City" value={[r.city, r.country].filter(Boolean).join(", ") || "—"} />
            <Row label="Joined" value={formatDate(r.createdAt)} />
            <Row label="Team members" value={String(r.users.length)} />
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <a href={`/r/${r.slug}`} target="_blank" rel="noreferrer">
                  Visit storefront
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {r.subscription ? (
              <>
                <Row label="Plan" value={r.subscription.plan.name} />
                <Row
                  label="Status"
                  value={
                    <Badge variant={subscriptionStatusVariant(r.subscription.status)}>
                      {r.subscription.status.toLowerCase()}
                    </Badge>
                  }
                />
                <Row label="Billing" value={r.subscription.billingCycle.toLowerCase()} />
                <Row
                  label="Amount"
                  value={formatMoney2(Number(r.subscription.amount), r.subscription.plan.currency)}
                />
                <Row label="Current period ends" value={formatDate(r.subscription.currentPeriodEnd)} />
                {r.subscription.trialEndsAt && (
                  <Row label="Trial ends" value={formatDate(r.subscription.trialEndsAt)} />
                )}
              </>
            ) : (
              <p className="text-fog-500">No active subscription.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {r.invoices.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-fog-500">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{formatMoney2(Number(inv.amount), inv.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={invoiceStatusVariant(inv.status)}>
                        {inv.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-fog-400">
                      {formatDate(inv.issuedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-1.5 last:border-0">
      <span className="text-fog-500">{label}</span>
      <span className="text-right text-fog-200">{value}</span>
    </div>
  );
}

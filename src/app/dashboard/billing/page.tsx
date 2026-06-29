import { CreditCard, Package, ShoppingBag, Users, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireTenant } from "@/lib/tenant";
import { getSubscription } from "@/lib/billing/subscription";
import { getEntitlements } from "@/lib/billing/limits";
import { listActivePlans } from "@/lib/billing/plans";
import { listInvoicesForRestaurant } from "@/lib/billing/invoices";
import { isStripeEnabled } from "@/lib/billing/stripe";
import {
  formatDate,
  formatMoney2,
  invoiceStatusVariant,
  subscriptionStatusVariant,
} from "@/lib/admin/format";
import { PlanManager, type PlanCardData } from "./PlanManager";
import { PortalButton } from "./PortalButton";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function BillingPage() {
  const { restaurantId } = await requireTenant();

  const [subscription, entitlements, plans, invoices, stripeEnabled] = await Promise.all([
    getSubscription(restaurantId),
    getEntitlements(restaurantId),
    listActivePlans(),
    listInvoicesForRestaurant(restaurantId),
    isStripeEnabled(),
  ]);

  const planCards: PlanCardData[] = plans.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    priceMonthly: Number(p.priceMonthly),
    priceYearly: Number(p.priceYearly),
    currency: p.currency,
    features: p.features,
    position: p.position,
    hasStripePriceMonthly: Boolean(p.stripePriceMonthlyId),
    hasStripePriceYearly: Boolean(p.stripePriceYearlyId),
  }));

  const current = subscription
    ? {
        slug: subscription.plan.slug,
        position: subscription.plan.position,
        status: subscription.status,
        cycle: subscription.billingCycle,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      }
    : null;

  const now = Date.now();
  const trialDaysLeft =
    subscription?.status === "TRIALING" && subscription.trialEndsAt
      ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now) / DAY))
      : null;

  const paidInvoices = invoices.filter((i) => i.status === "PAID");

  return (
    <>
      <PageHeader
        title="Subscription & Billing"
        description="Manage your plan, usage and payment history."
        action={stripeEnabled ? <PortalButton /> : undefined}
      />

      {/* Current plan summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-fog-400" /> Current plan
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Plan" value={subscription ? subscription.plan.name : "No plan"} />
          <Summary
            label="Status"
            value={
              subscription ? (
                <Badge variant={subscriptionStatusVariant(subscription.status)}>
                  {subscription.status.toLowerCase().replace("_", " ")}
                </Badge>
              ) : (
                "—"
              )
            }
          />
          <Summary
            label={subscription?.status === "TRIALING" ? "Trial ends" : "Renews"}
            value={subscription ? formatDate(subscription.currentPeriodEnd) : "—"}
            hint={trialDaysLeft != null ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left` : undefined}
          />
          <Summary
            label="Price"
            value={
              subscription
                ? `${formatMoney2(Number(subscription.amount), subscription.plan.currency)} / ${subscription.billingCycle === "YEARLY" ? "yr" : "mo"}`
                : "—"
            }
          />
        </CardContent>
        {subscription?.cancelAtPeriodEnd && (
          <CardContent className="pt-0">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
              Scheduled to cancel on {formatDate(subscription.currentPeriodEnd)}.
            </div>
          </CardContent>
        )}
        {subscription?.pendingPlanId && (
          <CardContent className="pt-0">
            <div className="rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-2.5 text-sm text-sky-200">
              A plan change is scheduled to take effect at the end of the current period.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage limits */}
      <div className="grid gap-3 sm:grid-cols-3">
        <UsageMeter icon={Package} label="Products" used={entitlements.limits.products.used} limit={entitlements.limits.products.limit} />
        <UsageMeter icon={ShoppingBag} label="Orders this month" used={entitlements.limits.orders.used} limit={entitlements.limits.orders.limit} />
        <UsageMeter icon={Users} label="Team members" used={entitlements.limits.staff.used} limit={entitlements.limits.staff.limit} />
      </div>

      {/* Plans */}
      <PlanManager plans={planCards} current={current} stripeEnabled={stripeEnabled} />

      {/* Invoices / payment history */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-fog-400" /> Payment history
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No invoices yet"
              description="Invoices will appear here once you're on a paid plan."
              className="border-0"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Document</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell className="text-fog-300">{inv.description ?? "—"}</TableCell>
                    <TableCell>{formatMoney2(Number(inv.amount), inv.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={invoiceStatusVariant(inv.status)}>{inv.status.toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-fog-400">{formatDate(inv.issuedAt)}</TableCell>
                    <TableCell className="text-right">
                      {inv.hostedUrl || inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl ?? inv.hostedUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-violet-400 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-fog-600">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-fog-600">
        {paidInvoices.length} paid invoice{paidInvoices.length === 1 ? "" : "s"} on record.
      </p>
    </>
  );
}

function Summary({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-fog-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-fog-100">{value}</div>
      {hint && <p className="mt-0.5 text-xs text-fog-500">{hint}</p>}
    </div>
  );
}

function UsageMeter({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: typeof Package;
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const near = limit != null && used / limit >= 0.8;
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-fog-300">
            <Icon className="h-4 w-4 text-fog-500" /> {label}
          </span>
          <span className="text-sm text-fog-400">
            {used}
            {limit != null ? ` / ${limit}` : <span className="text-emerald-300"> · Unlimited</span>}
          </span>
        </div>
        {limit != null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
            <div
              className={`h-full rounded-full ${near ? "bg-amber-400" : "bg-gradient-to-r from-violet-500 to-violet-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

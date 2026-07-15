import { CreditCard, Package, ShoppingBag, Users, ReceiptText, Download } from "lucide-react";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Subscription & Billing"
        description="Manage your plan, usage and payment history."
        action={stripeEnabled ? <PortalButton /> : undefined}
      />

      {/* Current plan — premium summary card */}
      <Card className="relative overflow-hidden border-violet-500/25 shadow-glow">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-gold-400/[0.06]"
        />
        <CardHeader className="relative pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 text-white shadow-glow">
                <CreditCard className="h-[18px] w-[18px]" />
              </span>
              <span>Current plan</span>
            </CardTitle>
            {subscription && (
              <Badge variant={subscriptionStatusVariant(subscription.status)}>
                {subscription.status.toLowerCase().replace("_", " ")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Plan" value={subscription ? subscription.plan.name : "No plan"} emphasis />
          <Summary
            label="Billing cycle"
            value={subscription ? (subscription.billingCycle === "YEARLY" ? "Yearly" : "Monthly") : "—"}
          />
          <Summary
            label={subscription?.status === "TRIALING" ? "Trial ends" : "Renews"}
            value={subscription ? formatDate(subscription.currentPeriodEnd) : "—"}
            hint={trialDaysLeft != null ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left` : undefined}
          />
          <Summary
            label="Amount"
            value={
              subscription
                ? `${formatMoney2(Number(subscription.amount), subscription.plan.currency)} / ${subscription.billingCycle === "YEARLY" ? "yr" : "mo"}`
                : "—"
            }
            emphasis
          />
        </CardContent>
        {subscription?.cancelAtPeriodEnd && (
          <CardContent className="relative pt-0">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
              Scheduled to cancel on {formatDate(subscription.currentPeriodEnd)}.
            </div>
          </CardContent>
        )}
        {subscription?.pendingPlanId && (
          <CardContent className="relative pt-0">
            <div className="rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-2.5 text-sm text-sky-200">
              A plan change is scheduled to take effect at the end of the current period.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage limits */}
      <div className="grid gap-4 sm:grid-cols-3">
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
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              {/* Lightweight receipt illustration (no external asset). */}
              <div className="relative mb-5" aria-hidden>
                <div className="absolute inset-0 -z-10 rounded-full bg-violet-500/10 blur-2xl" />
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-gradient-to-br from-ink-850 to-ink-900 shadow-soft">
                  <ReceiptText className="h-7 w-7 text-fog-400" />
                </div>
                <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-line bg-ink-900 text-emerald-300 shadow-soft">
                  <Download className="h-3 w-3" />
                </span>
              </div>
              <h3 className="text-base font-semibold text-fog-100">No invoices yet</h3>
              <p className="mt-1 max-w-sm text-sm text-fog-400">
                Invoices will appear here once you&apos;re on a paid plan — each with a
                downloadable receipt.
              </p>
            </div>
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
                  <TableRow key={inv.id} className="transition-colors hover:bg-ink-900/60">
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell className="text-fog-300">{inv.description ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatMoney2(Number(inv.amount), inv.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={invoiceStatusVariant(inv.status)}>{inv.status.toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-fog-400">{formatDate(inv.issuedAt)}</TableCell>
                    <TableCell className="text-right">
                      {inv.hostedUrl || inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl ?? inv.hostedUrl ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Download invoice ${inv.number}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900/40 px-2.5 py-1 text-xs font-medium text-fog-200 transition hover:border-fog-500 hover:text-fog-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
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
    </GsapReveal>
  );
}

function Summary({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-fog-500">{label}</p>
      <div className={cn("mt-1 font-medium text-fog-100", emphasis ? "text-lg" : "text-sm")}>{value}</div>
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
    <Card className="group h-full transition duration-200 hover:-translate-y-0.5 hover:border-fog-600 hover:shadow-glow">
      <CardContent className="flex h-full flex-col justify-between py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2.5 text-sm text-fog-300">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 text-fog-400 transition group-hover:text-violet-300">
              <Icon className="h-4 w-4" />
            </span>
            {label}
          </span>
          <span className="text-sm font-medium text-fog-200 tabular-nums">
            {used}
            {limit != null ? <span className="text-fog-500"> / {limit}</span> : null}
          </span>
        </div>
        {limit != null ? (
          <div className="mt-4">
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} usage: ${pct}% used`}
              className="h-2 overflow-hidden rounded-full bg-ink-800"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  near ? "bg-amber-400" : "bg-gradient-to-r from-violet-500 to-violet-400"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-fog-500">{pct}% used</p>
          </div>
        ) : (
          <p className="mt-4 text-xs font-medium text-emerald-300/80">Unlimited on your plan</p>
        )}
      </CardContent>
    </Card>
  );
}

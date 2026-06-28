import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar, ShoppingBag, Wallet, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CustomerStatus } from "@/lib/validations/customer";
import type { OrderStatus, PaymentStatus } from "@/lib/validations/order";
import { parseItemOptions } from "@/app/dashboard/orders/order-data";
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from "@/app/dashboard/orders/status";
import { CUSTOMER_STATUS_META } from "../status";
import { CustomerFormDialog } from "../CustomerFormDialog";
import { CustomerNotes } from "../CustomerNotes";
import { CustomerStatusControl, CustomerTagsControl } from "../CustomerProfileControls";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { restaurantId } = await requireTenant();
  const { id } = await params;

  const [customer, totalOrders, spendAgg, orders] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, restaurantId },
      include: { notes: { orderBy: { createdAt: "desc" } } },
    }),
    prisma.order.count({ where: { restaurantId, customerId: id } }),
    prisma.order.aggregate({
      where: { restaurantId, customerId: id, paymentStatus: "PAID" },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { restaurantId, customerId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { items: true },
    }),
  ]);

  if (!customer) notFound();

  const spending = Number(spendAgg._sum.total ?? 0);
  const paidCount = spendAgg._count._all;
  const aov = paidCount > 0 ? spending / paidCount : 0;
  const statusMeta = CUSTOMER_STATUS_META[customer.status as CustomerStatus];

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name || "Unnamed customer"}
        description={`Customer since ${formatDate(customer.createdAt, { hour: undefined, minute: undefined })}`}
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/customers">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <CustomerFormDialog
              customer={{
                id: customer.id,
                name: customer.name ?? "",
                phone: customer.phone,
                email: customer.email ?? "",
                address: customer.address ?? "",
                status: customer.status as CustomerStatus,
                tags: customer.tags,
              }}
              trigger={
                <Button>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              }
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
        <span className="font-mono text-xs text-fog-600">ID: {customer.id}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total orders" value={totalOrders} icon={ShoppingBag} />
        <StatCard label="Total spending" value={formatCurrency(spending)} icon={Wallet} accent="text-emerald-300" hint={`${paidCount} paid`} />
        <StatCard label="Avg. order value" value={formatCurrency(aov)} icon={TrendingUp} accent="text-violet-300" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Order history */}
        <div className="space-y-5 order-2 lg:order-1">
          <Card>
            <CardHeader>
              <CardTitle>Order history</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="No orders yet" description="This customer hasn't placed any orders." />
              ) : (
                <ol className="space-y-3">
                  {orders.map((o) => (
                    <li key={o.id} className="rounded-xl border border-line bg-ink-850 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/dashboard/orders/${o.id}`} className="font-medium text-fog-100 hover:underline">
                          #{o.orderNumber}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={ORDER_STATUS_META[o.status as OrderStatus].badge}>
                            {ORDER_STATUS_META[o.status as OrderStatus].label}
                          </Badge>
                          <Badge variant={PAYMENT_STATUS_META[o.paymentStatus as PaymentStatus].badge}>
                            {PAYMENT_STATUS_META[o.paymentStatus as PaymentStatus].label}
                          </Badge>
                          <span className="font-medium text-fog-100">{formatCurrency(Number(o.total))}</span>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-fog-500">{formatDate(o.createdAt)}</div>
                      <ul className="mt-2 space-y-1">
                        {o.items.map((item) => {
                          const opts = parseItemOptions(item.options);
                          return (
                            <li key={item.id} className="text-xs text-fog-400">
                              <span className="text-fog-200">{item.quantity}× {item.nameSnapshot}</span>
                              {opts.variant && <span> · {opts.variant.name}</span>}
                              {opts.extras.length > 0 && <span> · + {opts.extras.map((e) => e.name).join(", ")}</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: details, status, tags, notes */}
        <div className="space-y-5 order-1 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow icon={Phone} value={customer.phone} />
              {customer.email && <InfoRow icon={Mail} value={customer.email} />}
              {customer.address && <InfoRow icon={MapPin} value={customer.address} />}
              <InfoRow icon={Calendar} value={`Joined ${formatDate(customer.createdAt, { hour: undefined, minute: undefined })}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerStatusControl id={customer.id} status={customer.status as CustomerStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerTagsControl id={customer.id} tags={customer.tags} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerNotes
                customerId={customer.id}
                notes={customer.notes.map((n) => ({
                  id: n.id,
                  body: n.body,
                  createdAt: n.createdAt.toISOString(),
                  updatedAt: n.updatedAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, value }: { icon: typeof Phone; value: string }) {
  return (
    <div className="flex items-center gap-2 text-fog-200">
      <Icon className="h-4 w-4 shrink-0 text-fog-500" />
      <span className="break-words">{value}</span>
    </div>
  );
}

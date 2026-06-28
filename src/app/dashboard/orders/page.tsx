import Link from "next/link";
import { Plus, ClipboardList, BarChart3, ShoppingBag, Clock, Wallet, TrendingUp } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseDateParam } from "@/lib/date-range";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { StatCard } from "@/components/dashboard/StatCard";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import type { OrderStatus, PaymentStatus, PaymentMethod } from "@/lib/validations/order";
import { OrderFilters } from "./OrderFilters";
import { OrderRowActions } from "./OrderRowActions";
import { getOrderStats } from "./stats";
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  PAYMENT_METHOD_LABEL,
  ORDER_TYPE_LABEL,
} from "./status";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type SortKey = "newest" | "oldest" | "total-desc" | "total-asc";
const ORDER_BY: Record<SortKey, Prisma.OrderOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  "total-desc": { total: "desc" },
  "total-asc": { total: "asc" },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { restaurantId } = await requireTenant();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim() ?? "";
  const sort: SortKey = (sp.sort as SortKey) in ORDER_BY ? (sp.sort as SortKey) : "newest";

  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to, true);
  const createdAt =
    from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

  const where: Prisma.OrderWhereInput = {
    restaurantId,
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
            { customerPhone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(sp.status ? { status: sp.status as OrderStatus } : {}),
    ...(sp.payment ? { paymentStatus: sp.payment as PaymentStatus } : {}),
    ...(sp.method ? { paymentMethod: sp.method as PaymentMethod } : {}),
    ...(sp.type ? { type: sp.type as "DELIVERY" | "PICKUP" | "DINE_IN" } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(sp.customer ? { customerId: sp.customer } : {}),
  };

  const [stats, total, orders] = await Promise.all([
    getOrderStats(restaurantId),
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(
    search || sp.status || sp.payment || sp.method || sp.type || sp.from || sp.to || sp.customer
  );

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Orders"
        description="Track, manage and fulfil every order in one place."
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/orders/analytics">
                <BarChart3 className="h-4 w-4" /> Analytics
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/orders/new">
                <Plus className="h-4 w-4" /> New order
              </Link>
            </Button>
          </>
        }
      />

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total orders" value={stats.total} icon={ClipboardList} />
        <StatCard label="Today's orders" value={stats.today} icon={ShoppingBag} accent="text-sky-300" />
        <StatCard
          label="Total revenue"
          value={formatCurrency(stats.revenue)}
          icon={Wallet}
          accent="text-emerald-300"
          hint={`${stats.paidCount} paid orders`}
        />
        <StatCard
          label="Avg. order value"
          value={formatCurrency(stats.avgOrderValue)}
          icon={TrendingUp}
          accent="text-violet-300"
        />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {(["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as OrderStatus[]).map(
          (s) => (
            <Link
              key={s}
              href={`/dashboard/orders?status=${s}`}
              className="rounded-xl border border-line bg-ink-900/40 px-3 py-2.5 transition hover:border-fog-600"
            >
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-fog-500" />
                <span className="text-[11px] text-fog-400">{ORDER_STATUS_META[s].label}</span>
              </div>
              <div className="mt-1 text-xl font-semibold">{stats.byStatus[s]}</div>
            </Link>
          )
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SearchInput placeholder="Search order #, customer, phone…" />
        <OrderFilters />
      </div>

      {orders.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={ClipboardList}
            title="No orders match your filters"
            description="Try adjusting search, status or the date range."
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No orders yet"
            description="Create a walk-in order or wait for your first online order."
            action={
              <Button asChild>
                <Link href="/dashboard/orders/new">
                  <Plus className="h-4 w-4" /> New order
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const statusMeta = ORDER_STATUS_META[o.status as OrderStatus];
                const payMeta = PAYMENT_STATUS_META[o.paymentStatus as PaymentStatus];
                return (
                  <TableRow key={o.id} className="cursor-default">
                    <TableCell>
                      <Link href={`/dashboard/orders/${o.id}`} className="font-medium text-fog-100 hover:underline">
                        #{o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-fog-200">{o.customerName ?? <span className="text-fog-600">Walk-in</span>}</div>
                      {o.customerPhone && <div className="text-xs text-fog-500">{o.customerPhone}</div>}
                    </TableCell>
                    <TableCell className="text-fog-300">{ORDER_TYPE_LABEL[o.type]}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={payMeta.badge}>{payMeta.label}</Badge>
                        <span className="text-xs text-fog-500">
                          {PAYMENT_METHOD_LABEL[o.paymentMethod as PaymentMethod]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(o.total))}</TableCell>
                    <TableCell className="text-center text-fog-300">{o._count.items}</TableCell>
                    <TableCell>
                      <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-fog-400">
                      {formatDate(o.createdAt, { hour: undefined, minute: undefined })}
                    </TableCell>
                    <TableCell className="text-right">
                      <OrderRowActions
                        order={{
                          id: o.id,
                          status: o.status as OrderStatus,
                          paymentStatus: o.paymentStatus as PaymentStatus,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} />
        </Card>
      )}
    </GsapReveal>
  );
}

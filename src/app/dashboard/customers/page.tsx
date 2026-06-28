import Link from "next/link";
import { Plus, Users, UserPlus, UserCheck, UserX, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
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
import type { CustomerStatus } from "@/lib/validations/customer";
import { CustomerFilters } from "./CustomerFilters";
import { CustomerRowActions } from "./CustomerRowActions";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { ExportMenu } from "./ExportMenu";
import { getCustomerStats } from "./stats";
import { resolveCustomerQuery } from "./query";
import { CUSTOMER_STATUS_META } from "./status";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { restaurantId } = await requireTenant();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const { where, orderBy } = await resolveCustomerQuery(restaurantId, sp);

  const [stats, total, customers, tagRows] = await Promise.all([
    getCustomerStats(restaurantId),
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { orders: true } },
        orders: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.customer.findMany({ where: { restaurantId }, select: { tags: true }, take: 500 }),
  ]);

  const allTags = [...new Set(tagRows.flatMap((c) => c.tags))].sort();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(
    sp.q || sp.status || sp.tag || sp.from || sp.to || sp.minOrders || sp.minSpend
  );

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Customers"
        description="Your customer relationships, history and insights."
        action={
          <>
            <ExportMenu />
            <CustomerFormDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> New customer
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total customers" value={stats.total} icon={Users} />
        <StatCard label="New this month" value={stats.newThisMonth} icon={UserPlus} accent="text-sky-300" />
        <StatCard label="Active" value={stats.active} icon={UserCheck} accent="text-emerald-300" />
        <StatCard label="Inactive" value={stats.inactive} icon={UserX} accent="text-amber-300" />
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-fog-400">Growth</span>
            {stats.growthPct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-400" />
            )}
          </div>
          <div className={`mt-2 text-2xl font-semibold sm:text-3xl ${stats.growthPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
            {stats.growthPct >= 0 ? "+" : ""}
            {stats.growthPct.toFixed(0)}%
          </div>
          <p className="mt-1 text-xs text-fog-500">vs. last month</p>
        </Card>
        <StatCard label="Avg. order value" value={formatCurrency(stats.avgOrderValue)} icon={Wallet} accent="text-violet-300" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SearchInput placeholder="Search name, phone, email, ID…" />
        <CustomerFilters tags={allTags} />
      </div>

      {customers.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={Users} title="No customers match your filters" description="Try adjusting search or filters." />
        ) : (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add your first customer or they'll appear here after their first order."
            action={
              <CustomerFormDialog
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" /> New customer
                  </Button>
                }
              />
            }
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const statusMeta = CUSTOMER_STATUS_META[c.status as CustomerStatus];
                const lastOrder = c.orders[0]?.createdAt;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/dashboard/customers/${c.id}`} className="font-medium text-fog-100 hover:underline">
                        {c.name || "Unnamed"}
                      </Link>
                      <div className="font-mono text-[11px] text-fog-600">{c.id.slice(0, 10)}</div>
                      {c.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="violet">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-fog-300">{c.phone}</TableCell>
                    <TableCell className="text-fog-300">{c.email ?? <span className="text-fog-600">—</span>}</TableCell>
                    <TableCell className="text-center text-fog-200">{c._count.orders}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-fog-400">
                      {lastOrder ? formatDate(lastOrder, { hour: undefined, minute: undefined }) : <span className="text-fog-600">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-fog-400">
                      {formatDate(c.createdAt, { hour: undefined, minute: undefined })}
                    </TableCell>
                    <TableCell className="text-right">
                      <CustomerRowActions
                        customer={{
                          id: c.id,
                          name: c.name ?? "",
                          phone: c.phone,
                          email: c.email ?? "",
                          address: c.address ?? "",
                          status: c.status as CustomerStatus,
                          tags: c.tags,
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

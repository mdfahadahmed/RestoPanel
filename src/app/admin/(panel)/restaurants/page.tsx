import Link from "next/link";
import { Store } from "lucide-react";
import type { RestaurantStatus } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { ParamTabs } from "@/components/admin/ParamTabs";
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
import { listRestaurants } from "@/lib/admin/restaurants";
import { formatDate, formatNumber, restaurantStatusVariant } from "@/lib/admin/format";
import { RestaurantRowActions } from "./RestaurantRowActions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Pending", value: "PENDING" },
];

export default async function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (sp.status as RestaurantStatus | "ALL") ?? "ALL";

  const { rows, total, pageCount, perPage } = await listRestaurants({
    search: sp.q,
    status,
    page,
  });

  return (
    <>
      <PageHeader
        title="Restaurants"
        description={`${formatNumber(total)} restaurant${total === 1 ? "" : "s"} on the platform.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search name, slug, owner or email…" />
        <ParamTabs paramKey="status" options={STATUS_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No restaurants found"
          description="Try a different search or filter."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/admin/restaurants/${r.id}`}
                      className="font-medium text-fog-100 hover:text-violet-300"
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-fog-500">/{r.slug}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-fog-200">{r.ownerName}</div>
                    <div className="text-xs text-fog-500">{r.email ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    {r.subscription ? (
                      <span className="text-fog-200">{r.subscription.plan.name}</span>
                    ) : (
                      <span className="text-fog-600">No plan</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-fog-400">
                    {formatNumber(r._count.orders)} orders ·{" "}
                    {formatNumber(r._count.products)} products
                  </TableCell>
                  <TableCell>
                    <Badge variant={restaurantStatusVariant(r.status)}>
                      {r.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-fog-400">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RestaurantRowActions id={r.id} name={r.name} status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            totalPages={pageCount}
            totalItems={total}
            pageSize={perPage}
          />
        </Card>
      )}
    </>
  );
}

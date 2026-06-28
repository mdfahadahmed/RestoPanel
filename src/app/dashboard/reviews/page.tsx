import { Star, MessageSquare } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { StatCard } from "@/components/dashboard/StatCard";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ReviewFilters } from "./ReviewFilters";
import { ReviewItem } from "./ReviewItem";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { restaurantId } = await requireTenant();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim() ?? "";

  const where: Prisma.ReviewWhereInput = {
    restaurantId,
    ...(search
      ? {
          OR: [
            { customerName: { contains: search, mode: "insensitive" } },
            { comment: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(sp.rating ? { rating: Number(sp.rating) } : {}),
    ...(sp.visibility === "published" ? { isPublished: true } : {}),
    ...(sp.visibility === "hidden" ? { isPublished: false } : {}),
  };

  const [agg, distribution, total, reviews] = await Promise.all([
    prisma.review.aggregate({ where: { restaurantId }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.groupBy({ by: ["rating"], where: { restaurantId }, _count: { _all: true } }),
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { order: { select: { orderNumber: true } } },
    }),
  ]);

  const avg = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0;
  const totalReviews = agg._count._all;
  const distMap = new Map(distribution.map((d) => [d.rating, d._count._all]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search || sp.rating || sp.visibility);

  return (
    <GsapReveal className="space-y-6">
      <PageHeader title="Reviews" description="Manage and respond to customer reviews." />

      {/* Analytics */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Average rating" value={avg > 0 ? `${avg} ★` : "—"} accent="text-gold-300" />
          <StatCard label="Total reviews" value={totalReviews} icon={MessageSquare} />
        </div>
        <Card className="p-5">
          <h2 className="text-sm font-medium text-fog-200">Rating distribution</h2>
          <ul className="mt-3 space-y-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distMap.get(stars) ?? 0;
              const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <li key={stars} className="flex items-center gap-3 text-sm">
                  <span className="flex w-12 items-center gap-1 text-fog-400">
                    {stars} <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                    <div className="h-full rounded-full bg-gold-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-fog-500">{count}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput placeholder="Search reviews…" />
        <ReviewFilters />
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title={hasFilters ? "No reviews match your filters" : "No reviews yet"}
          description={hasFilters ? "Try adjusting search or filters." : "Reviews from delivered orders will appear here."}
        />
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <ReviewItem
              key={r.id}
              review={{
                id: r.id,
                customerName: r.customerName,
                rating: r.rating,
                comment: r.comment,
                reply: r.reply,
                createdAt: r.createdAt.toISOString(),
                isPublished: r.isPublished,
                orderId: r.orderId,
                orderNumber: r.order?.orderNumber ?? null,
              }}
            />
          ))}
          <Card className="overflow-hidden">
            <Pagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} />
          </Card>
        </div>
      )}
    </GsapReveal>
  );
}

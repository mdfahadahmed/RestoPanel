import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Resolve a restaurant by its public slug. Wrapped in React `cache` so the
 * layout and page in a single request share one query. Returns null when the
 * slug doesn't exist (callers should `notFound()`).
 *
 * This is the single entry point that maps a public slug → restaurantId; every
 * storefront query is then scoped by that restaurantId, so one restaurant's
 * site can never surface another's data.
 */
export const getRestaurantBySlug = cache(async (slug: string) => {
  if (!slug) return null;
  return prisma.restaurant.findUnique({ where: { slug } });
});

export interface OpeningHours {
  [day: string]: { open: string; close: string } | null;
}

export const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

/** Average + count of published reviews for a restaurant. */
export async function getReviewSummary(restaurantId: string) {
  const agg = await prisma.review.aggregate({
    where: { restaurantId, isPublished: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return {
    average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
    count: agg._count._all,
  };
}

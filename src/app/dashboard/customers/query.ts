import type { Prisma } from "@prisma/client";
import { parseDateParam } from "@/lib/date-range";
import { customerIdsForAggregates } from "./stats";
import type { CustomerStatus } from "@/lib/validations/customer";

export type CustomerSort = "newest" | "oldest" | "name" | "orders";

const ORDER_BY: Record<CustomerSort, Prisma.CustomerOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name: { name: "asc" },
  orders: { orders: { _count: "desc" } },
};

export type CustomerSearchParams = Record<string, string | undefined>;

/**
 * Resolve the tenant-scoped Prisma `where` + `orderBy` for the customer list,
 * applying search, status, tag, date-joined and aggregate (min orders / min
 * spending) filters. Shared by the list page and the export route so both stay
 * consistent.
 */
export async function resolveCustomerQuery(restaurantId: string, sp: CustomerSearchParams) {
  const search = sp.q?.trim() ?? "";
  const sort: CustomerSort = (sp.sort as CustomerSort) in ORDER_BY ? (sp.sort as CustomerSort) : "newest";

  const from = parseDateParam(sp.from);
  const to = parseDateParam(sp.to, true);
  const createdAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

  const minOrders = Math.max(0, Number(sp.minOrders) || 0);
  const minSpend = Math.max(0, Number(sp.minSpend) || 0);
  const aggregateIds = await customerIdsForAggregates(restaurantId, minOrders, minSpend);

  const where: Prisma.CustomerWhereInput = {
    restaurantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { id: { contains: search } },
          ],
        }
      : {}),
    ...(sp.status ? { status: sp.status as CustomerStatus } : {}),
    ...(sp.tag ? { tags: { has: sp.tag } } : {}),
    ...(createdAt ? { createdAt } : {}),
    // aggregateIds is null when no aggregate filter is active; otherwise restrict
    // to the matching ids (empty array ⇒ no matches).
    ...(aggregateIds ? { id: { in: aggregateIds } } : {}),
  };

  return { where, orderBy: ORDER_BY[sort], sort };
}

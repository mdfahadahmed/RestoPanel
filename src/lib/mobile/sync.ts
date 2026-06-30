import { prisma } from "@/lib/prisma";
import {
  serializeProduct,
  serializeCategory,
  serializeCustomer,
  serializeOrder,
} from "@/lib/api/serialize";

/**
 * Delta sync for the offline-capable mobile app. The client passes the cursor
 * from its last sync (`since`); we return every record changed since then plus a
 * fresh `serverTime` cursor. Products include soft-deleted rows flagged with
 * `deleted: true` so the client can tombstone them from its local cache.
 *
 * Tenant-scoped. Each resource is capped at `limit`; `hasMore` tells the client
 * to sync again immediately to drain a large backlog.
 */

const DEFAULT_LIMIT = 200;

export interface SyncDelta {
  serverTime: string;
  since: string | null;
  products: Array<ReturnType<typeof serializeProduct> & { deleted: boolean }>;
  categories: ReturnType<typeof serializeCategory>[];
  customers: ReturnType<typeof serializeCustomer>[];
  orders: ReturnType<typeof serializeOrder>[];
  hasMore: boolean;
}

export async function getSyncDelta(
  restaurantId: string,
  since?: Date | null,
  limit: number = DEFAULT_LIMIT
): Promise<SyncDelta> {
  const cap = Math.min(Math.max(1, limit), 500);
  const serverTime = new Date();
  const changedSince = since ? { updatedAt: { gt: since } } : {};

  const [products, categories, customers, orders] = await Promise.all([
    // Include soft-deleted products so the client can remove them locally.
    prisma.product.findMany({
      where: { restaurantId, ...changedSince },
      orderBy: { updatedAt: "asc" },
      take: cap,
    }),
    prisma.category.findMany({
      where: { restaurantId, ...changedSince },
      orderBy: { updatedAt: "asc" },
      take: cap,
    }),
    prisma.customer.findMany({
      where: { restaurantId, ...changedSince },
      orderBy: { updatedAt: "asc" },
      take: cap,
    }),
    prisma.order.findMany({
      where: { restaurantId, ...changedSince },
      orderBy: { updatedAt: "asc" },
      take: cap,
      include: { items: true },
    }),
  ]);

  const hasMore =
    products.length === cap ||
    categories.length === cap ||
    customers.length === cap ||
    orders.length === cap;

  return {
    serverTime: serverTime.toISOString(),
    since: since ? since.toISOString() : null,
    products: products.map((p) => ({ ...serializeProduct(p), deleted: p.deletedAt != null })),
    categories: categories.map(serializeCategory),
    customers: customers.map(serializeCustomer),
    orders: orders.map(serializeOrder),
    hasMore,
  };
}

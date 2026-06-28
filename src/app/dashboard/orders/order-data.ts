import { prisma } from "@/lib/prisma";

export interface ItemOptions {
  variant: { name: string; priceAdjustment: number } | null;
  extras: { name: string; price: number }[];
}

/** Parse the JSON options snapshot stored on an order item. */
export function parseItemOptions(options: unknown): ItemOptions {
  const o = (options ?? {}) as Partial<ItemOptions>;
  return {
    variant: o.variant ?? null,
    extras: Array.isArray(o.extras) ? o.extras : [],
  };
}

/** Load a single order fully, scoped to the tenant. Returns null if not found. */
export async function loadOrder(restaurantId: string, id: string) {
  return prisma.order.findFirst({
    where: { id, restaurantId },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
  });
}

export type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

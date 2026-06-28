import { prisma } from "@/lib/prisma";
import type { Extra, Variant } from "@/lib/validations/product";
import { unitPriceFor, round2, type OrderItemInput } from "@/lib/validations/order";

export interface BuiltOrderItem {
  productId: string;
  nameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  options: {
    variant: { name: string; priceAdjustment: number } | null;
    extras: { name: string; price: number }[];
  };
}

export type BuildItemsResult =
  | { ok: true; built: BuiltOrderItem[]; subtotal: number }
  | { ok: false; error: string };

// Effective per-unit base price (applies the product's percentage discount).
function effectiveBasePrice(price: number, discount: number): number {
  return discount > 0 ? round2(price * (1 - discount / 100)) : round2(price);
}

/**
 * Build order line items from client input using SERVER-side product data —
 * prices, variant adjustments and extra prices are always taken from the
 * tenant's own products, never trusted from the client. Shared by the dashboard
 * order action and the public storefront checkout so pricing stays identical
 * and tenant-scoped.
 */
export async function buildOrderItems(
  restaurantId: string,
  items: OrderItemInput[]
): Promise<BuildItemsResult> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { restaurantId, id: { in: ids }, deletedAt: null },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const built: BuiltOrderItem[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) return { ok: false, error: "One or more products were not found" };
    // Storefront orders may only contain orderable products.
    if (!product.isAvailable || product.status !== "ACTIVE") {
      return { ok: false, error: `"${product.name}" is not available` };
    }

    const base = effectiveBasePrice(Number(product.price), Number(product.discount));

    const productVariants = (product.variants as unknown as Variant[]) ?? [];
    let variant: { name: string; priceAdjustment: number } | null = null;
    if (item.variant) {
      const match = productVariants.find((v) => v.name === item.variant!.name);
      if (match) variant = { name: match.name, priceAdjustment: Number(match.priceAdjustment) || 0 };
    }

    const productExtras = (product.extras as unknown as Extra[]) ?? [];
    const extras: { name: string; price: number }[] = [];
    for (const ex of item.extras) {
      const match = productExtras.find((e) => e.name === ex.name && e.isActive !== false);
      if (match) extras.push({ name: match.name, price: Number(match.price) || 0 });
    }

    const unitPrice = unitPriceFor(base, variant, extras);
    built.push({
      productId: product.id,
      nameSnapshot: product.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal: round2(unitPrice * item.quantity),
      options: { variant, extras },
    });
  }

  const subtotal = round2(built.reduce((sum, b) => sum + b.lineTotal, 0));
  return { ok: true, built, subtotal };
}

/** Generate an order number unique within the tenant (sequential, zero-padded). */
export async function nextOrderNumber(restaurantId: string): Promise<string> {
  const count = await prisma.order.count({ where: { restaurantId } });
  for (let i = 1; i <= 25; i++) {
    const candidate = String(count + i).padStart(4, "0");
    const exists = await prisma.order.findFirst({
      where: { restaurantId, orderNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return String(Date.now());
}

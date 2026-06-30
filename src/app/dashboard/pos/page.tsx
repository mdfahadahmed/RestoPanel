import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getOpenDrawer, getDrawerSummary } from "@/lib/pos/drawer";
import { PosTerminal, type PosProduct, type PosCategory, type PosDrawer, type PosRecentSale } from "./PosTerminal";

export const dynamic = "force-dynamic";

export const metadata = { title: "Point of Sale" };

export default async function PosPage() {
  const { restaurantId } = await requireTenant();

  const [restaurant, categories, products, drawer, recent] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { currency: true, currencySymbol: true, taxRate: true, taxName: true },
    }),
    prisma.category.findMany({
      where: { restaurantId },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { restaurantId, deletedAt: null, status: "ACTIVE", isAvailable: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, discount: true, categoryId: true },
    }),
    getOpenDrawer(restaurantId),
    prisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, orderNumber: true, total: true, paymentStatus: true, customerName: true, createdAt: true },
    }),
  ]);

  const summary = drawer ? await getDrawerSummary(restaurantId, drawer.id) : null;

  const posProducts: PosProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    discount: Number(p.discount),
    categoryId: p.categoryId,
  }));
  const posCategories: PosCategory[] = categories.map((c) => ({ id: c.id, name: c.name }));
  const posDrawer: PosDrawer | null = summary
    ? {
        sessionId: summary.session.id,
        openingFloat: Number(summary.session.openingFloat),
        expected: summary.expected,
        openedAt: summary.session.openedAt.toISOString(),
        movements: summary.session.movements.length,
      }
    : null;
  const posRecent: PosRecentSale[] = recent.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    total: Number(o.total),
    paymentStatus: o.paymentStatus,
    customerName: o.customerName,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <PosTerminal
      currency={restaurant?.currency ?? "GBP"}
      taxRate={Number(restaurant?.taxRate ?? 0)}
      taxName={restaurant?.taxName ?? "Tax"}
      categories={posCategories}
      products={posProducts}
      drawer={posDrawer}
      recent={posRecent}
    />
  );
}

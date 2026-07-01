import { Boxes, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { InventoryTable, type InventoryRow, type StockStatus } from "./InventoryTable";

export const dynamic = "force-dynamic";

interface ProductImage {
  url?: string;
  key?: string;
}

export default async function InventoryPage() {
  const { restaurantId } = await requireTenant();

  const products = await prisma.product.findMany({
    where: { restaurantId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      images: true,
      price: true,
      stockQuantity: true,
      stockStatus: true,
      category: { select: { name: true } },
    },
  });

  const rows: InventoryRow[] = products.map((p) => {
    const images = Array.isArray(p.images) ? (p.images as ProductImage[]) : [];
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      imageUrl: images[0]?.url ?? null,
      categoryName: p.category?.name ?? null,
      price: Number(p.price),
      stockQuantity: p.stockQuantity,
      stockStatus: p.stockStatus as StockStatus,
    };
  });

  const summary = {
    total: rows.length,
    inStock: rows.filter((r) => r.stockStatus === "IN_STOCK").length,
    lowStock: rows.filter((r) => r.stockStatus === "LOW_STOCK").length,
    outOfStock: rows.filter((r) => r.stockStatus === "OUT_OF_STOCK").length,
  };

  const cards = [
    { label: "Products", value: summary.total, icon: Boxes, accent: "violet" },
    { label: "In stock", value: summary.inStock, icon: CheckCircle2, accent: "emerald" },
    { label: "Low stock", value: summary.lowStock, icon: AlertTriangle, accent: "amber" },
    { label: "Out of stock", value: summary.outOfStock, icon: XCircle, accent: "rose" },
  ] as const;

  const ACCENT: Record<string, string> = {
    violet: "from-violet-500/20 to-violet-500/5 text-violet-300",
    emerald: "from-emerald-400/20 to-emerald-400/5 text-emerald-300",
    amber: "from-amber-400/20 to-amber-400/5 text-amber-300",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-300",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">Inventory</h1>
        <p className="mt-1 text-sm text-fog-400">
          Track and adjust stock levels for every product.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-ink-900/50 p-4 shadow-soft">
            <div className={`mb-3 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${ACCENT[c.accent]}`}>
              <c.icon className="h-4.5 w-4.5" />
            </div>
            <p className="text-2xl font-semibold tracking-tight text-fog-100">
              {c.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-fog-400">{c.label}</p>
          </div>
        ))}
      </div>

      <InventoryTable rows={rows} />
    </div>
  );
}

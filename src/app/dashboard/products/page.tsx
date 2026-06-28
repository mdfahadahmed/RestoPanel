import Link from "next/link";
import { Plus, UtensilsCrossed, ImageIcon } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SearchInput } from "@/components/dashboard/SearchInput";
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
import type { ProductImage } from "@/lib/validations/product";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { ProductFilters } from "./ProductFilters";
import { ProductRowActions } from "./ProductRowActions";
import { RestoreProductButton } from "./RestoreProductButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const STOCK_BADGE: Record<string, { label: string; variant: "emerald" | "amber" | "rose" }> = {
  IN_STOCK: { label: "In stock", variant: "emerald" },
  LOW_STOCK: { label: "Low stock", variant: "amber" },
  OUT_OF_STOCK: { label: "Out of stock", variant: "rose" },
};

const STATUS_BADGE: Record<string, { label: string; variant: "emerald" | "amber" | "outline" }> = {
  ACTIVE: { label: "Active", variant: "emerald" },
  DRAFT: { label: "Draft", variant: "amber" },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

type SortKey = "newest" | "oldest" | "name" | "price-asc" | "price-desc";

const ORDER_BY: Record<SortKey, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name: { name: "asc" },
  "price-asc": { price: "asc" },
  "price-desc": { price: "desc" },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { restaurantId } = await requireTenant();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const search = sp.q?.trim() ?? "";
  const isTrash = sp.view === "trash";

  const statusFilter =
    sp.status && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(sp.status)
      ? (sp.status as "ACTIVE" | "DRAFT" | "ARCHIVED")
      : undefined;
  const sort: SortKey = (sp.sort as SortKey) in ORDER_BY ? (sp.sort as SortKey) : "newest";

  const where: Prisma.ProductWhereInput = {
    restaurantId,
    deletedAt: isTrash ? { not: null } : null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(sp.category ? { categoryId: sp.category } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(sp.availability === "available" ? { isAvailable: true } : {}),
    ...(sp.availability === "unavailable" ? { isAvailable: false } : {}),
    ...(sp.stock ? { stockStatus: sp.stock as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" } : {}),
    ...(sp.flag === "featured" ? { featured: true } : {}),
    ...(sp.flag === "bestSeller" ? { bestSeller: true } : {}),
  };

  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { name: true } } },
    }),
    prisma.category.findMany({
      where: { restaurantId },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(
    search || sp.category || sp.status || sp.availability || sp.stock || sp.flag
  );

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your menu items, pricing, stock and options."
        action={
          <Button asChild>
            <Link href="/dashboard/products/new">
              <Plus className="h-4 w-4" /> New product
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput placeholder="Search by name or SKU…" />
        <ProductFilters categories={categories} />
      </div>

      {products.length === 0 ? (
        isTrash ? (
          <EmptyState icon={UtensilsCrossed} title="Trash is empty" description="Deleted products will appear here." />
        ) : hasFilters ? (
          <EmptyState icon={UtensilsCrossed} title="No products match your filters" description="Try adjusting search or filters." />
        ) : (
          <EmptyState
            icon={UtensilsCrossed}
            title="No products yet"
            description="Add your first menu item to get started."
            action={
              <Button asChild>
                <Link href="/dashboard/products/new">
                  <Plus className="h-4 w-4" /> New product
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Item</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const images = (p.images as unknown as ProductImage[]) ?? [];
                const thumb = images[0]?.url;
                const price = Number(p.price);
                const discount = Number(p.discount);
                const effective = discount > 0 ? price * (1 - discount / 100) : price;
                const stock = STOCK_BADGE[p.stockStatus];
                const statusBadge = STATUS_BADGE[p.status];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-line bg-ink-850">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-fog-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-fog-100">{p.name}</div>
                      <div className="flex items-center gap-1.5">
                        {p.sku && <span className="text-xs text-fog-500">{p.sku}</span>}
                        {p.featured && <Badge variant="gold">Featured</Badge>}
                        {p.bestSeller && <Badge variant="violet">Best seller</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-fog-300">
                      {p.category?.name ?? <span className="text-fog-600">—</span>}
                    </TableCell>
                    <TableCell>
                      {discount > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(effective)}</span>
                          <span className="text-xs text-fog-500 line-through">
                            {formatCurrency(price)}
                          </span>
                          <Badge variant="emerald">-{discount}%</Badge>
                        </div>
                      ) : (
                        <span className="font-medium">{formatCurrency(price)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stock.variant}>{stock.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.isAvailable ? (
                        <Badge variant="emerald">Available</Badge>
                      ) : (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isTrash ? (
                        <RestoreProductButton id={p.id} />
                      ) : (
                        <ProductRowActions
                          product={{
                            id: p.id,
                            name: p.name,
                            isAvailable: p.isAvailable,
                            featured: p.featured,
                          }}
                        />
                      )}
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

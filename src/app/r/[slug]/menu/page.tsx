import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { toStoreProduct } from "@/lib/storefront/product";
import { MenuBrowser, type MenuItem } from "@/components/store/MenuBrowser";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { restaurantId: restaurant.id, deletedAt: null, status: "ACTIVE", isAvailable: true },
      orderBy: { name: "asc" },
      select: {
        id: true, slug: true, name: true, shortDescription: true, images: true,
        price: true, discount: true, featured: true, bestSeller: true, variants: true, extras: true,
        categoryId: true,
      },
    }),
    prisma.category.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const items: MenuItem[] = products.map((p) => ({ ...toStoreProduct(p), categoryId: p.categoryId }));
  const initialCategory = sp.category && categories.some((c) => c.id === sp.category) ? sp.category : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-fog-50">Menu</h1>
        <p className="mt-1 text-fog-400">{restaurant.name} · {items.length} items available</p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-ink-900/40 p-12 text-center text-fog-500">
          The menu is being prepared. Please check back soon.
        </p>
      ) : (
        <MenuBrowser slug={slug} items={items} categories={categories} initialCategory={initialCategory} />
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Clock, Flame, Leaf } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { effectivePrice, toStoreProduct } from "@/lib/storefront/product";
import type { Extra, ProductImage, Variant } from "@/lib/validations/product";
import { ProductGallery } from "@/components/store/ProductGallery";
import { AddToCart, type AddToCartProduct } from "@/components/store/AddToCart";
import { ProductCard } from "@/components/store/ProductCard";
import { FavoriteButton } from "@/components/store/FavoriteButton";
import { getCustomerSession } from "@/lib/account/context";
import { isFavorited } from "@/lib/account/service";

export const dynamic = "force-dynamic";

const CARD_SELECT = {
  id: true, slug: true, name: true, shortDescription: true, images: true,
  price: true, discount: true, featured: true, bestSeller: true, variants: true, extras: true,
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return { title: "Not found" };
  const product = await prisma.product.findFirst({
    where: { restaurantId: restaurant.id, slug: productSlug, deletedAt: null },
    select: { name: true, shortDescription: true, description: true },
  });
  if (!product) return { title: "Not found" };
  return {
    title: `${product.name} — ${restaurant.name}`,
    description: product.shortDescription ?? product.description ?? undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const product = await prisma.product.findFirst({
    where: { restaurantId: restaurant.id, slug: productSlug, deletedAt: null, status: "ACTIVE" },
  });
  if (!product) notFound();

  const images = ((product.images as unknown as ProductImage[]) ?? []).map((i) => i.url);
  const variants = (product.variants as unknown as Variant[]) ?? [];
  const extras = ((product.extras as unknown as Extra[]) ?? []).filter((e) => e.isActive !== false);
  const price = Number(product.price);
  const discount = Number(product.discount);
  const effective = effectivePrice(price, discount);

  const related = product.categoryId
    ? await prisma.product.findMany({
        where: {
          restaurantId: restaurant.id,
          categoryId: product.categoryId,
          id: { not: product.id },
          deletedAt: null,
          status: "ACTIVE",
          isAvailable: true,
        },
        take: 4,
        orderBy: { createdAt: "desc" },
        select: CARD_SELECT,
      })
    : [];

  const addToCartProduct: AddToCartProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: images[0] ?? null,
    effective,
    variants: variants.map((v) => ({ name: v.name, priceAdjustment: Number(v.priceAdjustment) || 0 })),
    extras: extras.map((e) => ({ name: e.name, price: Number(e.price) || 0 })),
  };

  const orderable = product.isAvailable;

  // Customer-account favourite state (guarded: the storefront is public, so a
  // missing/invalid session simply means "not logged in").
  let customerAccountId: string | null = null;
  try {
    const session = await getCustomerSession();
    customerAccountId = session?.accountId ?? null;
  } catch {
    customerAccountId = null;
  }
  const favorited = customerAccountId
    ? await isFavorited(customerAccountId, product.id)
    : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href={`/r/${slug}/menu`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-fog-400 hover:text-fog-100">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={images} alt={product.name} />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.featured && <span className="rounded-full bg-gold-400/90 px-2.5 py-0.5 text-xs font-bold text-ink-950">Featured</span>}
            {product.bestSeller && <span className="rounded-full bg-violet-500/90 px-2.5 py-0.5 text-xs font-bold text-white">Best seller</span>}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fog-50">{product.name}</h1>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-fog-100">{formatCurrency(effective, restaurant.currency)}</span>
            {discount > 0 && <span className="text-fog-600 line-through">{formatCurrency(price, restaurant.currency)}</span>}
            {discount > 0 && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">-{discount}%</span>}
          </div>

          {(product.shortDescription || product.description) && (
            <p className="mt-4 text-pretty leading-relaxed text-fog-300">
              {product.description ?? product.shortDescription}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-fog-400">
            {product.calories != null && (
              <span className="inline-flex items-center gap-1.5"><Flame className="h-4 w-4 text-gold-300" /> {product.calories} kcal</span>
            )}
            {product.prepTimeMins != null && (
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-gold-300" /> ~{product.prepTimeMins} min</span>
            )}
          </div>

          {product.ingredients.length > 0 && (
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-sm font-medium text-fog-200"><Leaf className="h-4 w-4 text-emerald-300" /> Ingredients</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {product.ingredients.map((ing) => (
                  <span key={ing} className="rounded-md bg-ink-800 px-2 py-1 text-xs text-fog-300">{ing}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            {orderable ? (
              <div className="flex-1">
                <AddToCart slug={slug} product={addToCartProduct} />
              </div>
            ) : (
              <p className="flex-1 rounded-xl border border-line bg-ink-900 px-4 py-3 text-sm text-fog-400">
                This item is currently unavailable.
              </p>
            )}
            <FavoriteButton
              productId={product.id}
              isLoggedIn={customerAccountId !== null}
              initialFavorited={favorited}
              loginNext={`/r/${slug}/product/${productSlug}`}
            />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-fog-50">You might also like</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} slug={slug} product={toStoreProduct(p)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

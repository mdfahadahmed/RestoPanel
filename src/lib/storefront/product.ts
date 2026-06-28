import type { Extra, ProductImage, Variant } from "@/lib/validations/product";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Per-unit price after applying the product's percentage discount. */
export function effectivePrice(price: number, discount: number): number {
  return discount > 0 ? round2(price * (1 - discount / 100)) : round2(price);
}

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  image: string | null;
  price: number; // original
  effective: number; // after discount
  discount: number;
  featured: boolean;
  bestSeller: boolean;
  hasOptions: boolean;
}

// Minimal shape needed from a Prisma product row.
interface ProductRow {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  images: unknown;
  price: unknown;
  discount: unknown;
  featured: boolean;
  bestSeller: boolean;
  variants: unknown;
  extras: unknown;
}

export function toStoreProduct(p: ProductRow): StoreProduct {
  const images = (p.images as unknown as ProductImage[]) ?? [];
  const variants = (p.variants as unknown as Variant[]) ?? [];
  const extras = (p.extras as unknown as Extra[]) ?? [];
  const price = Number(p.price);
  const discount = Number(p.discount);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    image: images[0]?.url ?? null,
    price,
    effective: effectivePrice(price, discount),
    discount,
    featured: p.featured,
    bestSeller: p.bestSeller,
    hasOptions: variants.length > 0 || extras.some((e) => e.isActive !== false),
  };
}

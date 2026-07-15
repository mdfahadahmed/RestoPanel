import { requireCustomer } from "@/lib/account/context";
import { listFavorites } from "@/lib/account/service";
import {
  FavoritesList,
  type FavoriteItem,
} from "@/components/account/FavoritesList";

export const dynamic = "force-dynamic";

interface ProductImage {
  url?: string;
  key?: string;
}

export default async function AccountFavoritesPage() {
  const customer = await requireCustomer();
  const favorites = await listFavorites(customer.accountId);

  const items: FavoriteItem[] = favorites.map((f) => {
    const images = Array.isArray(f.product.images)
      ? (f.product.images as ProductImage[])
      : [];
    return {
      productId: f.product.id,
      name: f.product.name,
      productSlug: f.product.slug,
      restaurantSlug: f.product.restaurant.slug,
      restaurantName: f.product.restaurant.name,
      currency: f.product.restaurant.currency,
      price: Number(f.product.price),
      discount: Number(f.product.discount),
      imageUrl: images[0]?.url ?? null,
      available: f.product.isAvailable && f.product.status === "ACTIVE",
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-100">
          Favorites
        </h1>
        <p className="mt-1 text-sm text-fog-400">
          Your saved dishes — reorder any of them in one tap.
        </p>
      </div>
      <FavoritesList items={items} />
    </div>
  );
}

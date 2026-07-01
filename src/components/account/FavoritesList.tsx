"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, RotateCcw, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { removeFavorite } from "@/app/account/actions";
import { formatCurrency } from "@/lib/utils";

export interface FavoriteItem {
  productId: string;
  name: string;
  productSlug: string;
  restaurantSlug: string;
  restaurantName: string;
  price: number;
  discount: number;
  imageUrl: string | null;
  available: boolean;
}

export function FavoritesList({ items }: { items: FavoriteItem[] }) {
  const [favorites, setFavorites] = useState(items);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(productId: string) {
    setPendingId(productId);
    startTransition(async () => {
      const res = await removeFavorite(productId);
      if (res.ok) {
        setFavorites((prev) => prev.filter((f) => f.productId !== productId));
        toast.success("Removed from favourites");
      } else {
        toast.error(res.error);
      }
      setPendingId(null);
    });
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-ink-900/30 px-6 py-16 text-center">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line bg-ink-850 text-fog-400">
          <Heart className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold">No favourites yet</h3>
        <p className="mt-1 max-w-sm text-sm text-fog-400">
          Tap the heart on any dish while browsing a restaurant to save it here for
          quick reordering.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {favorites.map((f) => {
        const finalPrice =
          f.discount > 0 ? f.price * (1 - f.discount / 100) : f.price;
        return (
          <div
            key={f.productId}
            className="group overflow-hidden rounded-2xl border border-line bg-ink-900/40"
          >
            <div className="relative aspect-[4/3] bg-ink-850">
              {f.imageUrl ? (
                <Image
                  src={f.imageUrl}
                  alt={f.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-fog-600">
                  <UtensilsCrossed className="h-8 w-8" />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(f.productId)}
                disabled={pendingId === f.productId}
                aria-label="Remove from favourites"
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-rose-300 backdrop-blur transition hover:bg-black/80 disabled:opacity-50"
              >
                <Heart className="h-4 w-4 fill-current" />
              </button>
              {!f.available && (
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-fog-300 backdrop-blur">
                  Unavailable
                </span>
              )}
            </div>

            <div className="p-4">
              <p className="truncate text-sm font-medium text-fog-100">{f.name}</p>
              <p className="truncate text-xs text-fog-500">{f.restaurantName}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-fog-100">
                    {formatCurrency(finalPrice)}
                  </span>
                  {f.discount > 0 && (
                    <span className="text-xs text-fog-600 line-through">
                      {formatCurrency(f.price)}
                    </span>
                  )}
                </div>
                <Link
                  href={`/r/${f.restaurantSlug}/product/${f.productSlug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-fog-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reorder
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

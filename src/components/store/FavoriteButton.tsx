"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { addFavorite, removeFavorite } from "@/app/account/actions";

/**
 * Save/unsave a product to the signed-in customer's favourites (account panel).
 * Guests are sent to the account login page.
 */
export function FavoriteButton({
  productId,
  isLoggedIn,
  initialFavorited,
  loginNext,
}: {
  productId: string;
  isLoggedIn: boolean;
  initialFavorited: boolean;
  loginNext: string;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!isLoggedIn) {
      router.push(`/account/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const res = next ? await addFavorite(productId) : await removeFavorite(productId);
      if (!res.ok) {
        setFavorited(!next);
        toast.error(res.error);
      } else {
        toast.success(next ? "Saved to favourites" : "Removed from favourites");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from favourites" : "Save to favourites"}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition disabled:opacity-60 ${
        favorited
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
          : "border-line bg-ink-900 text-fog-300 hover:bg-ink-800 hover:text-fog-100"
      }`}
    >
      <Heart className={`h-4 w-4 ${favorited ? "fill-current" : ""}`} />
      {favorited ? "Saved" : "Save"}
    </button>
  );
}

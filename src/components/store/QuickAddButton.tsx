"use client";

import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "./cart/CartProvider";
import type { StoreProduct } from "@/lib/storefront/product";

/** One-tap add for products with no variants/extras. */
export function QuickAddButton({ product }: { product: StoreProduct }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    add({
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      image: product.image,
      unitPrice: product.effective,
      quantity: 1,
      variant: null,
      extras: [],
    });
    toast.success(`${product.name} added to cart`);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <button
      onClick={handleAdd}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-400 text-ink-950 transition hover:bg-gold-300"
      aria-label={`Add ${product.name} to cart`}
    >
      {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useCart } from "./cart/CartProvider";

export interface AddToCartProduct {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  effective: number;
  variants: { name: string; priceAdjustment: number }[];
  extras: { name: string; price: number }[];
}

export function AddToCart({ slug, product }: { slug: string; product: AddToCartProduct }) {
  const { add } = useCart();
  const router = useRouter();
  const [variant, setVariant] = useState<string | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const variantObj = variant ? product.variants.find((v) => v.name === variant) ?? null : null;
  const extraObjs = product.extras.filter((e) => extras.includes(e.name));
  const unitPrice =
    product.effective + (variantObj?.priceAdjustment ?? 0) + extraObjs.reduce((s, e) => s + e.price, 0);

  function buildItem() {
    return {
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      image: product.image,
      unitPrice: Math.round((unitPrice + Number.EPSILON) * 100) / 100,
      quantity: qty,
      variant: variantObj ? { name: variantObj.name, priceAdjustment: variantObj.priceAdjustment } : null,
      extras: extraObjs.map((e) => ({ name: e.name, price: e.price })),
    };
  }

  function addToCart(thenCheckout = false) {
    add(buildItem());
    toast.success(`${product.name} added to cart`);
    if (thenCheckout) router.push(`/r/${slug}/cart`);
  }

  return (
    <div className="space-y-5">
      {product.variants.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-fog-200">Choose a variant</p>
          <div className="flex flex-wrap gap-2">
            <OptionChip active={variant === null} onClick={() => setVariant(null)} label="Standard" />
            {product.variants.map((v) => (
              <OptionChip
                key={v.name}
                active={variant === v.name}
                onClick={() => setVariant(v.name)}
                label={v.name}
                hint={v.priceAdjustment ? `+${formatCurrency(v.priceAdjustment)}` : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {product.extras.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-fog-200">Add extras</p>
          <div className="flex flex-wrap gap-2">
            {product.extras.map((e) => {
              const on = extras.includes(e.name);
              return (
                <OptionChip
                  key={e.name}
                  active={on}
                  onClick={() =>
                    setExtras((prev) => (on ? prev.filter((n) => n !== e.name) : [...prev, e.name]))
                  }
                  label={e.name}
                  hint={`+${formatCurrency(e.price)}`}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full border border-line bg-ink-900">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center text-fog-300 hover:text-fog-50" aria-label="Decrease quantity">
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center font-medium">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-10 w-10 place-items-center text-fog-300 hover:text-fog-50" aria-label="Increase quantity">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm text-fog-400">
          {formatCurrency(unitPrice)} <span className="text-fog-600">each</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => addToCart(false)}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300"
        >
          <ShoppingBag className="h-4 w-4" /> Add to cart · {formatCurrency(unitPrice * qty)}
        </button>
        <button
          onClick={() => addToCart(true)}
          className="rounded-full border border-line bg-ink-900 px-6 py-3 font-medium text-fog-100 transition hover:bg-ink-800"
        >
          Buy now
        </button>
      </div>
    </div>
  );
}

function OptionChip({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3.5 py-2 text-sm transition",
        active ? "border-gold-400/60 bg-gold-400/10 text-gold-100" : "border-line bg-ink-900 text-fog-300 hover:text-fog-100"
      )}
    >
      {label}
      {hint && <span className="ml-1.5 text-xs text-fog-500">{hint}</span>}
    </button>
  );
}

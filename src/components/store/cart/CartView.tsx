"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "./CartProvider";

export function CartView({ slug }: { slug: string }) {
  const { items, subtotal, setQuantity, remove, count, ready, format } = useCart();
  const base = `/r/${slug}`;

  if (!ready) {
    return <div className="h-40 animate-pulse rounded-2xl border border-line bg-ink-900/40" />;
  }

  if (items.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-ink-900/40 px-6 py-16 text-center">
        <ShoppingBag className="h-10 w-10 text-fog-700" />
        <h2 className="mt-4 text-lg font-medium text-fog-100">Your cart is empty</h2>
        <p className="mt-1 text-sm text-fog-500">Add some delicious items from the menu.</p>
        <Link href={`${base}/menu`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold-400 px-5 py-2.5 font-medium text-ink-950 hover:bg-gold-300">
          Browse menu <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.lineId} className="flex gap-3 rounded-2xl border border-line bg-ink-900/50 p-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-850">
              {item.image ? (
                <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <Link href={`${base}/product/${item.productSlug}`} className="font-medium text-fog-100 hover:underline">
                  {item.name}
                </Link>
                <button onClick={() => remove(item.lineId)} className="text-fog-500 hover:text-rose-400" aria-label="Remove item">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {item.variant && <p className="text-xs text-fog-500">{item.variant.name}</p>}
              {item.extras.length > 0 && (
                <p className="text-xs text-fog-500">+ {item.extras.map((e) => e.name).join(", ")}</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center rounded-full border border-line bg-ink-900">
                  <button onClick={() => setQuantity(item.lineId, item.quantity - 1)} className="grid h-8 w-8 place-items-center text-fog-300 hover:text-fog-50" aria-label="Decrease">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm">{item.quantity}</span>
                  <button onClick={() => setQuantity(item.lineId, item.quantity + 1)} className="grid h-8 w-8 place-items-center text-fog-300 hover:text-fog-50" aria-label="Increase">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="font-medium text-fog-100">{format(item.unitPrice * item.quantity)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="h-fit rounded-2xl border border-line bg-ink-900/50 p-5">
        <h2 className="font-semibold text-fog-100">Order summary</h2>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-fog-400">Subtotal ({count} item{count === 1 ? "" : "s"})</span>
          <span className="font-medium">{format(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-fog-500">Taxes & delivery calculated at checkout.</p>
        <Link
          href={`${base}/checkout`}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300"
        >
          Checkout <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href={`${base}/menu`} className="mt-2 inline-block w-full text-center text-sm text-fog-400 hover:text-fog-100">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { ImageIcon, Settings2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { StoreProduct } from "@/lib/storefront/product";
import { QuickAddButton } from "./QuickAddButton";

export function ProductCard({ slug, product }: { slug: string; product: StoreProduct }) {
  const href = `/r/${slug}/product/${product.slug}`;
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-900/50 transition hover:border-fog-700 hover:shadow-soft">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-ink-850">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-fog-700">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {product.featured && (
            <span className="rounded-full bg-gold-400/90 px-2 py-0.5 text-[10px] font-bold text-ink-950">Featured</span>
          )}
          {product.bestSeller && (
            <span className="rounded-full bg-violet-500/90 px-2 py-0.5 text-[10px] font-bold text-white">Best seller</span>
          )}
          {product.discount > 0 && (
            <span className="rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-white">-{product.discount}%</span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5">
        <Link href={href}>
          <h3 className="font-medium text-fog-100 transition group-hover:text-white">{product.name}</h3>
        </Link>
        {product.shortDescription && (
          <p className="mt-1 line-clamp-2 text-xs text-fog-500">{product.shortDescription}</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-fog-100">{formatCurrency(product.effective)}</span>
            {product.discount > 0 && (
              <span className="text-xs text-fog-600 line-through">{formatCurrency(product.price)}</span>
            )}
          </div>
          {product.hasOptions ? (
            <Link
              href={href}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-ink-850 text-fog-200 transition hover:text-fog-50"
              aria-label={`Customise ${product.name}`}
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          ) : (
            <QuickAddButton product={product} />
          )}
        </div>
      </div>
    </div>
  );
}

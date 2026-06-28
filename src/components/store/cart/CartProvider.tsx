"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

export interface CartVariant {
  name: string;
  priceAdjustment: number;
}
export interface CartExtra {
  name: string;
  price: number;
}
export interface CartItem {
  /** Stable line id (product + chosen options). */
  lineId: string;
  productId: string;
  productSlug: string;
  name: string;
  image: string | null;
  unitPrice: number; // base (incl. discount) + variant + extras, per unit
  quantity: number;
  variant: CartVariant | null;
  extras: CartExtra[];
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "lineId">) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

function lineIdFor(item: Omit<CartItem, "lineId">): string {
  const v = item.variant?.name ?? "";
  const e = item.extras.map((x) => x.name).sort().join(",");
  return `${item.productId}|${v}|${e}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const storageKey = `restopanel:cart:${slug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      // ignore corrupt storage
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist whenever items change (after hydration).
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items, ready, storageKey]);

  const add = useCallback((item: Omit<CartItem, "lineId">) => {
    const lineId = lineIdFor(item);
    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) =>
          i.lineId === lineId ? { ...i, quantity: Math.min(99, i.quantity + item.quantity) } : i
        );
      }
      return [...prev, { ...item, lineId }];
    });
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.lineId === lineId ? { ...i, quantity: Math.max(0, Math.min(99, quantity)) } : i))
        .filter((i) => i.quantity > 0)
    );
  }, []);

  const remove = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotal = round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
    return { items, count, subtotal, add, setQuantity, remove, clear, ready };
  }, [items, add, setQuantity, remove, clear, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

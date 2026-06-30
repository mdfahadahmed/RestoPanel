"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanLine, Plus, Minus, Trash2, Receipt, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";
import { round2 } from "@/lib/validations/order";
import { applyDiscount, type DiscountInput, type TenderInput } from "@/lib/pos/shared";
import { TenderDialog } from "./TenderDialog";
import { DrawerPanel } from "./DrawerPanel";
import { createPosSale, lookupBarcode, refundPosSale } from "./actions";

export interface PosProduct {
  id: string;
  name: string;
  price: number;
  discount: number; // percentage
  categoryId: string | null;
}
export interface PosCategory {
  id: string;
  name: string;
}
export interface PosDrawer {
  sessionId: string;
  openingFloat: number;
  expected: number;
  openedAt: string;
  movements: number;
}
export interface PosRecentSale {
  id: string;
  orderNumber: string;
  total: number;
  paymentStatus: string;
  customerName: string | null;
  createdAt: string;
}

interface CartLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

interface PosTerminalProps {
  currency: string;
  taxRate: number;
  taxName: string;
  categories: PosCategory[];
  products: PosProduct[];
  drawer: PosDrawer | null;
  recent: PosRecentSale[];
}

function effectivePrice(price: number, discount: number): number {
  return discount > 0 ? round2(price * (1 - discount / 100)) : round2(price);
}

export function PosTerminal({
  currency,
  taxRate,
  taxName,
  categories,
  products,
  drawer,
  recent,
}: PosTerminalProps) {
  const router = useRouter();
  const money = (n: number) => formatCurrency(n, currency);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState<DiscountInput | null>(null);
  const [type, setType] = useState<"DINE_IN" | "PICKUP">("DINE_IN");
  const [customerName, setCustomerName] = useState("");
  const [tenderOpen, setTenderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<{ orderId: string; orderNumber: string; change: number } | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (activeCat === "all" || p.categoryId === activeCat) &&
        (q === "" || p.name.toLowerCase().includes(q))
    );
  }, [products, activeCat, search]);

  const subtotal = useMemo(
    () => round2(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
    [cart]
  );
  const discountAmount = useMemo(() => applyDiscount(subtotal, discount), [subtotal, discount]);
  const taxAmount = useMemo(
    () => round2(((subtotal - discountAmount) * taxRate) / 100),
    [subtotal, discountAmount, taxRate]
  );
  const total = round2(Math.max(0, subtotal - discountAmount + taxAmount));

  function addProduct(p: { id: string; name: string; price: number; discount?: number }) {
    const unit = effectivePrice(p.price, p.discount ?? 0);
    setCart((prev) => {
      const found = prev.find((l) => l.productId === p.id);
      if (found) return prev.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { productId: p.id, name: p.name, unitPrice: unit, quantity: 1 }];
    });
    setLastSale(null);
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function clearCart() {
    setCart([]);
    setDiscount(null);
    setCustomerName("");
  }

  async function onScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Quick path: match a code already in the loaded product list by exact name.
    const res = await lookupBarcode(trimmed);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "No product matches that code" : res.error);
      return;
    }
    addProduct({ id: res.data.id, name: res.data.name, price: res.data.price });
    if (barcodeRef.current) barcodeRef.current.value = "";
  }

  async function onConfirmPayment(tenders: TenderInput[]) {
    setBusy(true);
    const res = await createPosSale({
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, extras: [] })),
      type,
      customerName: customerName || undefined,
      discount: discount ?? undefined,
      tenders,
    });
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "Sale failed" : res.error);
      return;
    }
    toast.success(`Sale #${res.data.orderNumber} complete`);
    setLastSale({ orderId: res.data.orderId, orderNumber: res.data.orderNumber, change: res.data.change });
    setTenderOpen(false);
    clearCart();
    router.refresh();
  }

  async function refund(sale: PosRecentSale) {
    setBusy(true);
    const res = await refundPosSale({ orderId: sale.id, method: "CASH" });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Refunded #${sale.orderNumber}`);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Catalogue ------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fog-500" />
            <Input
              ref={barcodeRef}
              placeholder="Scan barcode / SKU, then Enter"
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onScan((e.target as HTMLInputElement).value);
                }
              }}
            />
          </div>
          <Input
            placeholder="Search menu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
            All
          </CatChip>
          {categories.map((c) => (
            <CatChip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
              {c.name}
            </CatChip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p)}
              className="flex h-24 flex-col justify-between rounded-2xl border border-line bg-ink-900/60 p-3 text-left transition-colors hover:border-violet-500/50 hover:bg-ink-850"
            >
              <span className="line-clamp-2 text-sm font-medium text-fog-100">{p.name}</span>
              <span className="text-sm font-semibold text-gold-300">
                {money(effectivePrice(p.price, p.discount))}
              </span>
            </button>
          ))}
          {visibleProducts.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-fog-500">No products</p>
          )}
        </div>
      </div>

      {/* Cart + drawer --------------------------------------------------- */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-ink-900/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Current sale</h2>
            <div className="flex overflow-hidden rounded-lg border border-line text-xs">
              {(["DINE_IN", "PICKUP"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn("px-2.5 py-1", type === t ? "bg-violet-500/20 text-violet-200" : "text-fog-400")}
                >
                  {t === "DINE_IN" ? "Dine in" : "Takeaway"}
                </button>
              ))}
            </div>
          </div>

          {lastSale && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
              <p className="font-medium text-emerald-200">Sale #{lastSale.orderNumber} complete</p>
              {lastSale.change > 0 && <p className="text-emerald-300">Change due {money(lastSale.change)}</p>}
              <a
                href={`/print/orders/${lastSale.orderId}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-violet-300 hover:underline"
              >
                <Receipt className="size-4" /> Print receipt
              </a>
            </div>
          )}

          <ul className="mt-3 space-y-2">
            {cart.length === 0 && !lastSale && (
              <li className="py-6 text-center text-sm text-fog-500">Tap products or scan to start</li>
            )}
            {cart.map((l) => (
              <li key={l.productId} className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-fog-100">{l.name}</p>
                  <p className="text-xs text-fog-500">{money(l.unitPrice)} each</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconBtn onClick={() => changeQty(l.productId, -1)} label="Decrease">
                    <Minus className="size-4" />
                  </IconBtn>
                  <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                  <IconBtn onClick={() => changeQty(l.productId, 1)} label="Increase">
                    <Plus className="size-4" />
                  </IconBtn>
                </div>
                <span className="w-16 text-right text-sm font-semibold text-fog-100">
                  {money(round2(l.unitPrice * l.quantity))}
                </span>
              </li>
            ))}
          </ul>

          {cart.length > 0 && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  placeholder="Customer (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <select
                  value={discount?.kind ?? ""}
                  onChange={(e) =>
                    setDiscount(
                      e.target.value
                        ? { kind: e.target.value as "AMOUNT" | "PERCENT", value: discount?.value ?? 0 }
                        : null
                    )
                  }
                  aria-label="Discount type"
                  className="h-9 rounded-xl border border-line bg-ink-800/70 px-2 text-sm text-fog-100"
                >
                  <option value="">No discount</option>
                  <option value="PERCENT">% off</option>
                  <option value="AMOUNT">Amount off</option>
                </select>
                {discount && (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount.value}
                    onChange={(e) => setDiscount({ ...discount, value: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Discount value"
                    className="h-9 w-24"
                  />
                )}
              </div>

              <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                <Line label="Subtotal" value={money(subtotal)} />
                {discountAmount > 0 && <Line label="Discount" value={`−${money(discountAmount)}`} accent="text-emerald-300" />}
                {taxAmount > 0 && <Line label={taxName} value={money(taxAmount)} />}
                <div className="flex justify-between pt-1 text-base font-bold">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
              </dl>

              <div className="mt-3 flex gap-2">
                <Button variant="ghost" onClick={clearCart} className="flex-1">
                  <Trash2 className="size-4" /> Clear
                </Button>
                <Button variant="primary" className="flex-[2]" onClick={() => setTenderOpen(true)}>
                  Charge {money(total)}
                </Button>
              </div>
            </>
          )}
        </div>

        <DrawerPanel drawer={drawer} currency={currency} />

        {recent.length > 0 && (
          <div className="rounded-2xl border border-line bg-ink-900/50 p-4">
            <h2 className="font-semibold tracking-tight">Recent sales</h2>
            <ul className="mt-2 divide-y divide-line">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium text-fog-100">#{s.orderNumber}</p>
                    <p className="text-xs text-fog-500">{money(s.total)} · {s.paymentStatus.toLowerCase()}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/print/orders/${s.id}/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-fog-400 hover:bg-ink-800 hover:text-violet-300"
                      aria-label="Print receipt"
                    >
                      <Receipt className="size-4" />
                    </a>
                    {s.paymentStatus !== "REFUNDED" && (
                      <IconBtn onClick={() => refund(s)} label="Refund" disabled={busy}>
                        <RotateCcw className="size-4" />
                      </IconBtn>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <TenderDialog
        open={tenderOpen}
        onClose={() => setTenderOpen(false)}
        total={total}
        currency={currency}
        busy={busy}
        onConfirm={onConfirmPayment}
      />
    </div>
  );
}

function CatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-violet-500/50 bg-violet-500/15 text-violet-200" : "border-line text-fog-400 hover:bg-ink-800"
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-300 hover:bg-ink-800 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Line({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-fog-400">{label}</dt>
      <dd className={accent ?? "text-fog-100"}>{value}</dd>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  computeTotals,
  unitPriceFor,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/validations/order";
import type { Extra, Variant } from "@/lib/validations/product";
import { createOrder } from "./actions";

export interface OrderFormProduct {
  id: string;
  name: string;
  price: number;
  discount: number;
  variants: Variant[];
  extras: Extra[];
}
export interface OrderFormCustomer {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
}

interface LineItem {
  key: string;
  productId: string;
  quantity: number;
  variantName: string | null;
  extraNames: string[];
}

type FieldErrors = Record<string, string[] | undefined>;

let keySeq = 0;
const nextKey = () => `line-${keySeq++}`;

export function OrderForm({
  products,
  customers,
}: {
  products: OrderFormProduct[];
  customers: OrderFormCustomer[];
}) {
  const router = useRouter();
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [customerId, setCustomerId] = useState("none");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("UNPAID");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [restaurantNotes, setRestaurantNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [addId, setAddId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  function selectCustomer(id: string) {
    setCustomerId(id);
    if (id === "none") return;
    const c = customers.find((x) => x.id === id);
    if (c) {
      setName(c.name ?? "");
      setPhone(c.phone);
      setEmail(c.email ?? "");
    }
  }

  function addItem(productId: string) {
    if (!productId || !productMap.has(productId)) return;
    setItems((prev) => [...prev, { key: nextKey(), productId, quantity: 1, variantName: null, extraNames: [] }]);
    setAddId("");
  }
  function patchItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function basePriceOf(p: OrderFormProduct) {
    return p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price;
  }
  function lineUnitPrice(it: LineItem): number {
    const p = productMap.get(it.productId);
    if (!p) return 0;
    const variant = it.variantName ? p.variants.find((v) => v.name === it.variantName) ?? null : null;
    const extras = p.extras.filter((e) => it.extraNames.includes(e.name) && e.isActive !== false);
    return unitPriceFor(
      basePriceOf(p),
      variant ? { priceAdjustment: variant.priceAdjustment } : null,
      extras
    );
  }

  const subtotal = items.reduce((sum, it) => sum + lineUnitPrice(it) * it.quantity, 0);
  const totals = computeTotals(
    subtotal,
    Number(discount) || 0,
    Number(tax) || 0,
    type === "DELIVERY" ? Number(deliveryFee) || 0 : 0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    const payloadItems = items.map((it) => {
      const p = productMap.get(it.productId)!;
      const variant = it.variantName ? p.variants.find((v) => v.name === it.variantName) : null;
      const extras = p.extras
        .filter((e) => it.extraNames.includes(e.name) && e.isActive !== false)
        .map((e) => ({ name: e.name, price: e.price }));
      return {
        productId: it.productId,
        quantity: it.quantity,
        variant: variant ? { name: variant.name, priceAdjustment: variant.priceAdjustment } : null,
        extras,
      };
    });

    const payload = {
      customerId: customerId === "none" ? null : customerId,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      address,
      type,
      paymentMethod,
      paymentStatus,
      items: payloadItems,
      discountAmount: Number(discount) || 0,
      taxAmount: Number(tax) || 0,
      deliveryFee: Number(deliveryFee) || 0,
      notes,
      restaurantNotes,
    };

    setPending(true);
    try {
      const res = await createOrder(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Order created");
      router.push(res.data?.id ? `/dashboard/orders/${res.data.id}` : "/dashboard/orders");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-24">
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: items */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Select value={addId} onValueChange={(v) => addItem(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add a product…" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No products available
                      </SelectItem>
                    ) : (
                      products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(basePriceOf(p))}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {err("items") && <p className="text-xs text-rose-400">{err("items")}</p>}

              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-ink-850 px-4 py-6 text-center text-sm text-fog-500">
                  No items yet. Add products above.
                </p>
              ) : (
                <div className="space-y-3">
                  {items.map((it) => {
                    const p = productMap.get(it.productId);
                    if (!p) return null;
                    const activeExtras = p.extras.filter((e) => e.isActive !== false);
                    const unit = lineUnitPrice(it);
                    return (
                      <div key={it.key} className="rounded-xl border border-line bg-ink-850 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-fog-100">{p.name}</div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(it.key)} aria-label="Remove item">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-fog-500">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => patchItem(it.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                              className="h-9"
                            />
                          </div>
                          {p.variants.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-[11px] text-fog-500">Variant</Label>
                              <Select
                                value={it.variantName ?? "none"}
                                onValueChange={(v) => patchItem(it.key, { variantName: v === "none" ? null : v })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {p.variants.map((v) => (
                                    <SelectItem key={v.name} value={v.name}>
                                      {v.name}
                                      {v.priceAdjustment ? ` (+${formatCurrency(v.priceAdjustment)})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {activeExtras.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <Label className="text-[11px] text-fog-500">Extras</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {activeExtras.map((ex) => {
                                const on = it.extraNames.includes(ex.name);
                                return (
                                  <button
                                    type="button"
                                    key={ex.name}
                                    onClick={() =>
                                      patchItem(it.key, {
                                        extraNames: on
                                          ? it.extraNames.filter((n) => n !== ex.name)
                                          : [...it.extraNames, ex.name],
                                      })
                                    }
                                    className={
                                      "rounded-full border px-2.5 py-1 text-xs transition " +
                                      (on
                                        ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                                        : "border-line bg-ink-800 text-fog-400 hover:text-fog-200")
                                    }
                                  >
                                    {ex.name} +{formatCurrency(ex.price)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="mt-2 flex justify-end text-sm">
                          <span className="text-fog-400">
                            {formatCurrency(unit)} × {it.quantity} ={" "}
                            <span className="font-medium text-fog-100">{formatCurrency(unit * it.quantity)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="notes">Customer note</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="e.g. ring the doorbell" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rnotes">Restaurant note (internal)</Label>
                <Textarea id="rnotes" value={restaurantNotes} onChange={(e) => setRestaurantNotes(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: customer + payment + totals */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {customers.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Existing customer</Label>
                  <Select value={customerId} onValueChange={selectCustomer}>
                    <SelectTrigger>
                      <SelectValue placeholder="New / walk-in" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">New / walk-in</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name ?? "Unnamed"} · {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="cname">Name</Label>
                <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
                {err("customerName") && <p className="text-xs text-rose-400">{err("customerName")}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cphone">Phone</Label>
                  <Input id="cphone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cemail">Email</Label>
                  <Input id="cemail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
                  {err("customerEmail") && <p className="text-xs text-rose-400">{err("customerEmail")}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Order type</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DELIVERY">Delivery</SelectItem>
                    <SelectItem value="PICKUP">Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "DELIVERY" && (
                <div className="space-y-1.5">
                  <Label htmlFor="addr">Delivery address</Label>
                  <Textarea id="addr" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
                  {err("address") && <p className="text-xs text-rose-400">{err("address")}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment & charges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="ONLINE">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment status</Label>
                  <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNPAID">Unpaid</SelectItem>
                      <SelectItem value="PAID">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="discount">Discount (£)</Label>
                  <Input id="discount" type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tax">Tax (£)</Label>
                  <Input id="tax" type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery">Delivery (£)</Label>
                  <Input
                    id="delivery"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="h-9"
                    disabled={type !== "DELIVERY"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <SummaryRow label="Subtotal" value={totals.subtotal} />
              {totals.discountAmount > 0 && <SummaryRow label="Discount" value={-totals.discountAmount} accent="text-emerald-300" />}
              {totals.taxAmount > 0 && <SummaryRow label="Tax" value={totals.taxAmount} />}
              {totals.deliveryFee > 0 && <SummaryRow label="Delivery fee" value={totals.deliveryFee} />}
              <div className="flex items-center justify-between border-t border-line pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-950/90 px-5 py-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <span className="text-sm text-fog-400">
            {items.length} item{items.length === 1 ? "" : "s"} · {formatCurrency(totals.total)}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/dashboard/orders")} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || items.length === 0}>
              <Plus className="h-4 w-4" /> {pending ? "Creating…" : "Create order"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-fog-300">
      <span>{label}</span>
      <span className={accent}>{formatCurrency(value)}</span>
    </div>
  );
}

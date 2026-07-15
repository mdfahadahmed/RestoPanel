"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeTotals, round2 } from "@/lib/validations/order";
import { useCart } from "./cart/CartProvider";
import { placeOrderPublic, validateCouponPublic } from "@/app/r/[slug]/actions";

export interface CheckoutSettings {
  taxRate: number;
  deliveryFee: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  codEnabled: boolean;
}

type OrderType = "DELIVERY" | "PICKUP" | "DINE_IN";
type FieldErrors = Record<string, string[] | undefined>;

export function CheckoutForm({ slug, settings }: { slug: string; settings: CheckoutSettings }) {
  const router = useRouter();
  const { items, subtotal, clear, ready, format } = useCart();

  const typeOptions = useMemo(() => {
    const opts: { value: OrderType; label: string; icon: typeof Truck }[] = [];
    if (settings.deliveryEnabled) opts.push({ value: "DELIVERY", label: "Delivery", icon: Truck });
    if (settings.pickupEnabled) opts.push({ value: "PICKUP", label: "Takeaway", icon: ShoppingBag });
    if (settings.dineInEnabled) opts.push({ value: "DINE_IN", label: "Dine in", icon: UtensilsCrossed });
    return opts;
  }, [settings]);

  const paymentOptions = useMemo(() => {
    const opts: { value: "CASH" | "CARD" | "ONLINE"; label: string }[] = [];
    if (settings.codEnabled) opts.push({ value: "CASH", label: "Cash" });
    if (settings.onlinePaymentsEnabled) {
      opts.push({ value: "CARD", label: "Card" });
      opts.push({ value: "ONLINE", label: "Online" });
    }
    return opts.length > 0 ? opts : [{ value: "CASH" as const, label: "Cash" }];
  }, [settings]);

  const [type, setType] = useState<OrderType>(typeOptions[0]?.value ?? "PICKUP");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "ONLINE">(
    paymentOptions[0].value
  );
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const taxAmount = round2(((subtotal - discount) * settings.taxRate) / 100);
  const deliveryFee = type === "DELIVERY" ? settings.deliveryFee : 0;
  const totals = computeTotals(subtotal, discount, taxAmount, deliveryFee);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponPending(true);
    try {
      const res = await validateCouponPublic(slug, couponInput.trim(), subtotal);
      if (!res.ok) {
        setCoupon(null);
        toast.error(res.error);
        return;
      }
      setCoupon(res.data!);
      toast.success(`Coupon ${res.data!.code} applied`);
    } finally {
      setCouponPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    const payload = {
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      address,
      type,
      paymentMethod,
      notes,
      couponCode: coupon?.code ?? "",
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        variant: i.variant ? { name: i.variant.name, priceAdjustment: i.variant.priceAdjustment } : null,
        extras: i.extras.map((x) => ({ name: x.name, price: x.price })),
      })),
    };

    setPending(true);
    try {
      const res = await placeOrderPublic(slug, payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      clear();
      if (res.data!.online) {
        // Online payment — continue to the secure payment step.
        router.push(`/r/${slug}/pay/${res.data!.orderId}`);
      } else {
        toast.success("Order placed!");
        router.push(`/r/${slug}/track/${res.data!.orderNumber}`);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  if (typeOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-ink-900/40 p-12 text-center">
        <p className="text-fog-400">Online ordering is currently unavailable for this restaurant.</p>
        <Link href={`/r/${slug}`} className="mt-4 inline-block rounded-full bg-gold-400 px-5 py-2.5 font-medium text-ink-950 hover:bg-gold-300">
          Back to home
        </Link>
      </div>
    );
  }

  if (ready && items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-ink-900/40 p-12 text-center">
        <p className="text-fog-400">Your cart is empty.</p>
        <Link href={`/r/${slug}/menu`} className="mt-4 inline-block rounded-full bg-gold-400 px-5 py-2.5 font-medium text-ink-950 hover:bg-gold-300">
          Browse menu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        {/* Order type */}
        <Section title="Order type">
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => setType(o.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-sm transition",
                  type === o.value ? "border-gold-400/60 bg-gold-400/10 text-gold-100" : "border-line bg-ink-900 text-fog-300 hover:text-fog-100"
                )}
              >
                <o.icon className="h-5 w-5" />
                {o.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Customer details */}
        <Section title="Your details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" error={err("customerName")}>
              <input value={name} onChange={(e) => setName(e.target.value)} className="store-input" placeholder="Jane Doe" />
            </Field>
            <Field label="Phone" error={err("customerPhone")}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="store-input" placeholder="07…" />
            </Field>
            <Field label="Email (optional)" error={err("customerEmail")}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="store-input" placeholder="you@email.com" />
            </Field>
            {type === "DELIVERY" && (
              <Field label="Delivery address" error={err("address")} full>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="store-input" placeholder="Street, city, postcode" />
              </Field>
            )}
            <Field label="Notes (optional)" full>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="store-input" placeholder="Allergies, delivery instructions…" />
            </Field>
          </div>
        </Section>

        {/* Payment */}
        <Section title="Payment">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${paymentOptions.length}, minmax(0, 1fr))` }}
          >
            {paymentOptions.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={() => setPaymentMethod(m.value)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-sm transition",
                  paymentMethod === m.value ? "border-gold-400/60 bg-gold-400/10 text-gold-100" : "border-line bg-ink-900 text-fog-300 hover:text-fog-100"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-fog-500">
            {paymentMethod === "CASH"
              ? "Pay on collection or delivery."
              : "You'll complete a secure payment on the next step."}
          </p>
        </Section>
      </div>

      {/* Summary */}
      <div className="h-fit rounded-2xl border border-line bg-ink-900/50 p-5">
        <h2 className="font-semibold text-fog-100">Summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.lineId} className="flex justify-between gap-2 text-fog-300">
              <span className="min-w-0 truncate">{i.quantity}× {i.name}</span>
              <span>{format(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
        </ul>
        {/* Coupon */}
        <div className="mt-3 border-t border-line pt-3">
          {coupon ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
              <span className="text-emerald-300">Coupon <strong>{coupon.code}</strong> applied</span>
              <button type="button" onClick={() => { setCoupon(null); setCouponInput(""); }} className="text-fog-400 hover:text-fog-100">Remove</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                aria-label="Coupon code"
                className="store-input"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponPending || !couponInput.trim()}
                className="shrink-0 rounded-xl border border-line bg-ink-850 px-4 text-sm font-medium text-fog-100 transition hover:bg-ink-800 disabled:opacity-60"
              >
                {couponPending ? "…" : "Apply"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          <Row label="Subtotal" value={totals.subtotal} format={format} />
          {totals.discountAmount > 0 && <Row label="Discount" value={-totals.discountAmount} format={format} />}
          {totals.taxAmount > 0 && <Row label={`Tax (${settings.taxRate}%)`} value={totals.taxAmount} format={format} />}
          {type === "DELIVERY" && <Row label="Delivery fee" value={totals.deliveryFee} format={format} />}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-fog-100">
            <span>Total</span>
            <span>{format(totals.total)}</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending || items.length === 0}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300 disabled:opacity-60"
        >
          {pending ? "Placing order…" : `Place order · ${format(totals.total)}`}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-ink-900/50 p-5">
      <h2 className="mb-3 font-semibold text-fog-100">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <label className="text-xs text-fog-400">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function Row({ label, value, format }: { label: string; value: number; format: (v: number) => string }) {
  return (
    <div className="flex justify-between text-fog-300">
      <span>{label}</span>
      <span>{format(value)}</span>
    </div>
  );
}

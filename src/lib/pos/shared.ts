import { round2 } from "@/lib/validations/order";

/**
 * Pure, dependency-free POS helpers and types. Kept apart from the Prisma-backed
 * modules (`sale.ts`, `drawer.ts`) so client components can import them without
 * pulling the DB client into the browser bundle.
 */

export type DiscountKind = "AMOUNT" | "PERCENT";

export interface DiscountInput {
  kind: DiscountKind;
  value: number;
}

/**
 * Resolve a discount to a concrete amount, clamped to [0, subtotal]. A PERCENT
 * discount is `value`% of the subtotal; an AMOUNT is taken as-is.
 */
export function applyDiscount(subtotal: number, discount: DiscountInput | null | undefined): number {
  const safeSubtotal = Math.max(0, subtotal);
  if (!discount || discount.value <= 0) return 0;
  const raw =
    discount.kind === "PERCENT"
      ? (safeSubtotal * Math.min(100, Math.max(0, discount.value))) / 100
      : discount.value;
  return round2(Math.min(Math.max(0, raw), safeSubtotal));
}

/** Change owed back when `tendered` cash covers an amount `due`. Never negative. */
export function computeChange(tendered: number, due: number): number {
  return round2(Math.max(0, tendered - due));
}

export type PosPaymentMethod = "CASH" | "CARD" | "ONLINE";

export interface TenderInput {
  method: PosPaymentMethod;
  amount: number;
  tendered?: number; // cash handed over (cash only)
  cardLast4?: string;
  reference?: string;
}

/** Total of a set of tenders (split bill). */
export function sumTenders(tenders: { amount: number }[]): number {
  return round2(tenders.reduce((s, t) => s + (Number(t.amount) || 0), 0));
}

/**
 * Split a total into `parts` equal amounts. Rounding remainder is absorbed by
 * the last part so the parts always sum back to exactly `total`.
 */
export function splitEqually(total: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const base = round2(Math.max(0, total) / n);
  const result = Array.from({ length: n }, () => base);
  const drift = round2(round2(base * n) - round2(Math.max(0, total)));
  result[n - 1] = round2(result[n - 1] - drift);
  return result;
}

export type DrawerMovementKind = "OPENING" | "SALE" | "REFUND" | "PAY_IN" | "PAY_OUT";

/**
 * Expected cash in a drawer: the opening float plus every signed cash movement
 * (SALE +, REFUND −, PAY_IN +, PAY_OUT −). OPENING rows are audit-only and
 * excluded — the float is already counted via `openingFloat`.
 */
export function expectedDrawerCash(
  openingFloat: number,
  movements: { type: DrawerMovementKind; amount: number }[]
): number {
  const moved = movements
    .filter((m) => m.type !== "OPENING")
    .reduce((s, m) => s + (Number(m.amount) || 0), 0);
  return round2(openingFloat + moved);
}

/** Variance at close: counted minus expected (negative = short, positive = over). */
export function drawerVariance(countedCash: number, expectedCash: number): number {
  return round2(countedCash - expectedCash);
}

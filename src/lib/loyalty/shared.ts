import { round2 } from "@/lib/validations/order";

/**
 * Pure, dependency-free loyalty maths and the VIP tier model. Safe to import
 * from client components (settings form, tier overview) — no Prisma.
 */

export interface VipTier {
  name: string;
  minLifetimePoints: number;
  multiplier: number; // points-earning multiplier at this tier
}

/** Default VIP ladder, used when a program hasn't customised its tiers. */
export const DEFAULT_TIERS: VipTier[] = [
  { name: "Bronze", minLifetimePoints: 0, multiplier: 1 },
  { name: "Silver", minLifetimePoints: 500, multiplier: 1.25 },
  { name: "Gold", minLifetimePoints: 2000, multiplier: 1.5 },
  { name: "Platinum", minLifetimePoints: 5000, multiplier: 2 },
];

/** Coerce arbitrary JSON into a sorted, valid tier ladder (falls back to default). */
export function normaliseTiers(raw: unknown): VipTier[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TIERS;
  const tiers = raw
    .filter((t): t is VipTier => !!t && typeof t === "object" && "name" in t && "minLifetimePoints" in t)
    .map((t) => ({
      name: String(t.name),
      minLifetimePoints: Math.max(0, Number(t.minLifetimePoints) || 0),
      multiplier: Number(t.multiplier) > 0 ? Number(t.multiplier) : 1,
    }));
  if (tiers.length === 0) return DEFAULT_TIERS;
  return tiers.sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
}

/** The VIP tier a customer is in given their lifetime points. */
export function tierForPoints(lifetimePoints: number, tiers: VipTier[] = DEFAULT_TIERS): VipTier {
  const sorted = [...tiers].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
  let current = sorted[0] ?? DEFAULT_TIERS[0];
  for (const t of sorted) {
    if (lifetimePoints >= t.minLifetimePoints) current = t;
    else break;
  }
  return current;
}

/** Points earned for an order total at a given rate + tier multiplier (floored). */
export function pointsForOrder(total: number, pointsPerCurrency: number, multiplier: number): number {
  if (total <= 0 || pointsPerCurrency <= 0) return 0;
  return Math.floor(total * pointsPerCurrency * Math.max(0, multiplier));
}

/** Cashback (store credit) earned for an order total at a percentage rate. */
export function cashbackForOrder(total: number, cashbackPercent: number): number {
  if (total <= 0 || cashbackPercent <= 0) return 0;
  return round2((total * cashbackPercent) / 100);
}

/** Currency value of redeeming `points` at `pointValue` per point. */
export function redeemValue(points: number, pointValue: number): number {
  return round2(Math.max(0, points) * pointValue);
}

/** Progress (0–1) and the next tier above the current one, for UI. */
export function tierProgress(
  lifetimePoints: number,
  tiers: VipTier[] = DEFAULT_TIERS
): { current: VipTier; next: VipTier | null; toNext: number } {
  const sorted = [...tiers].sort((a, b) => a.minLifetimePoints - b.minLifetimePoints);
  const current = tierForPoints(lifetimePoints, sorted);
  const next = sorted.find((t) => t.minLifetimePoints > current.minLifetimePoints) ?? null;
  const toNext = next ? Math.max(0, next.minLifetimePoints - lifetimePoints) : 0;
  return { current, next, toNext };
}

/** Same calendar month + day (used for birthday matching, year-agnostic). */
export function isSameMonthDay(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

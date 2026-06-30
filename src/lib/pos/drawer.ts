import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/validations/order";
import {
  drawerVariance,
  expectedDrawerCash,
  type DrawerMovementKind,
} from "@/lib/pos/shared";

/** The tenant's currently open drawer session, if any. */
export async function getOpenDrawer(restaurantId: string) {
  return prisma.drawerSession.findFirst({
    where: { restaurantId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

export type OpenDrawerResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

/** Open a drawer with a starting float. Only one session may be open at a time. */
export async function openDrawer(
  restaurantId: string,
  openedById: string | null,
  openingFloat: number
): Promise<OpenDrawerResult> {
  const existing = await getOpenDrawer(restaurantId);
  if (existing) return { ok: false, error: "A drawer session is already open" };

  const float = round2(Math.max(0, openingFloat));
  const session = await prisma.drawerSession.create({
    data: {
      restaurantId,
      openedById,
      openingFloat: new Prisma.Decimal(float),
      movements: {
        create: { restaurantId, type: "OPENING", amount: new Prisma.Decimal(float), reason: "Opening float" },
      },
    },
    select: { id: true },
  });
  return { ok: true, sessionId: session.id };
}

export type MovementResult = { ok: true } | { ok: false; error: string };

/**
 * Record a manual cash movement (PAY_IN / PAY_OUT) against an open session.
 * `magnitude` is always positive; the sign is derived from the type.
 */
export async function addDrawerMovement(
  restaurantId: string,
  sessionId: string,
  type: Extract<DrawerMovementKind, "PAY_IN" | "PAY_OUT">,
  magnitude: number,
  reason?: string
): Promise<MovementResult> {
  const session = await prisma.drawerSession.findFirst({
    where: { id: sessionId, restaurantId, status: "OPEN" },
    select: { id: true },
  });
  if (!session) return { ok: false, error: "No open drawer session" };

  const mag = round2(Math.abs(magnitude));
  if (!(mag > 0)) return { ok: false, error: "Amount must be positive" };
  const amount = type === "PAY_OUT" ? -mag : mag;

  await prisma.drawerMovement.create({
    data: {
      restaurantId,
      drawerSessionId: sessionId,
      type,
      amount: new Prisma.Decimal(amount),
      reason: reason || null,
    },
  });
  return { ok: true };
}

/** Live drawer state: the session, its movements, and the expected cash total. */
export async function getDrawerSummary(restaurantId: string, sessionId: string) {
  const session = await prisma.drawerSession.findFirst({
    where: { id: sessionId, restaurantId },
    include: { movements: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return null;
  const expected = expectedDrawerCash(
    Number(session.openingFloat),
    session.movements.map((m) => ({ type: m.type as DrawerMovementKind, amount: Number(m.amount) }))
  );
  return { session, expected };
}

export type CloseDrawerResult =
  | { ok: true; expected: number; counted: number; variance: number }
  | { ok: false; error: string };

/** Close an open drawer: compute expected cash and the variance vs the count. */
export async function closeDrawer(
  restaurantId: string,
  sessionId: string,
  countedCash: number
): Promise<CloseDrawerResult> {
  const summary = await getDrawerSummary(restaurantId, sessionId);
  if (!summary || summary.session.status !== "OPEN") {
    return { ok: false, error: "No open drawer session" };
  }

  const counted = round2(Math.max(0, countedCash));
  const expected = summary.expected;
  const variance = drawerVariance(counted, expected);

  await prisma.drawerSession.update({
    where: { id: sessionId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      expectedCash: new Prisma.Decimal(expected),
      countedCash: new Prisma.Decimal(counted),
      variance: new Prisma.Decimal(variance),
    },
  });
  return { ok: true, expected, counted, variance };
}

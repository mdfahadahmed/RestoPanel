import { prisma } from "@/lib/prisma";
import {
  KDS_BOARD_STATUSES,
  compareTickets,
  estimatePrepMins,
  kdsColumnForStatus,
  type KdsBoard,
  type KdsTicket,
} from "@/lib/kds/shared";

/**
 * Kitchen Display System data access. Tenant-id-parameterized so it can be
 * unit-tested directly — the server actions in
 * `src/app/dashboard/kitchen/actions.ts` wrap these with `requireTenant()`.
 *
 * The board respects the existing order state machine: it only reads the
 * kitchen-relevant statuses, and transitions still go through the shared
 * `updateOrderStatus` action (which enforces `canTransition()`).
 */

// Re-export the pure helpers/types so callers can import everything from here.
export * from "@/lib/kds/shared";

/**
 * Load the live kitchen board for a tenant, grouped and sorted into the three
 * columns. Always scoped by `restaurantId` — never trust a client-supplied id.
 */
export async function getKitchenBoard(restaurantId: string): Promise<KdsBoard> {
  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { in: KDS_BOARD_STATUSES } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNumber: true,
      type: true,
      status: true,
      customerName: true,
      total: true,
      kitchenPriority: true,
      notes: true,
      createdAt: true,
      items: {
        select: {
          nameSnapshot: true,
          quantity: true,
          product: { select: { prepTimeMins: true } },
        },
      },
      events: {
        select: { status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const board: KdsBoard = { new: [], preparing: [], ready: [] };

  for (const order of orders) {
    const column = kdsColumnForStatus(order.status);
    if (!column) continue;

    // When the order entered its current status (latest matching event), else
    // fall back to when it was created.
    const statusEvent = order.events.find((e) => e.status === order.status);
    const statusSince = (statusEvent?.createdAt ?? order.createdAt).toISOString();

    const ticket: KdsTicket = {
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      customerName: order.customerName,
      total: Number(order.total),
      kitchenPriority: order.kitchenPriority,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      statusSince,
      targetPrepMins: estimatePrepMins(
        order.items.map((i) => ({ prepTimeMins: i.product?.prepTimeMins ?? null }))
      ),
      items: order.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity })),
    };

    board[column].push(ticket);
  }

  board.new.sort(compareTickets);
  board.preparing.sort(compareTickets);
  board.ready.sort(compareTickets);

  return board;
}

export interface SetPriorityResult {
  ok: boolean;
  count: number;
}

/**
 * Flag/unflag an order as a kitchen rush. Tenant-scoped: a no-op (count 0) if
 * the order belongs to another restaurant.
 */
export async function setKitchenPriority(
  restaurantId: string,
  orderId: string,
  value: boolean
): Promise<SetPriorityResult> {
  const res = await prisma.order.updateMany({
    where: { id: orderId, restaurantId },
    data: { kitchenPriority: value },
  });
  return { ok: res.count > 0, count: res.count };
}

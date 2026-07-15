import type { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Tenant-scoped support helpers for the restaurant dashboard. Every query is
 * filtered by the caller's `restaurantId` so an owner can only ever see and
 * reply to their own tickets — the same golden rule as the rest of the app.
 * (The admin side uses `lib/admin/support.ts`, which is intentionally not
 * tenant-scoped.)
 */

export async function listTicketsForRestaurant(
  restaurantId: string,
  filters: { status?: TicketStatus | "ALL"; page?: number; perPage?: number } = {}
) {
  const { status = "ALL", page = 1, perPage = 20 } = filters;
  const where: Prisma.SupportTicketWhereInput = { restaurantId };
  if (status !== "ALL") where.status = status;

  const [total, rows, openCount] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { _count: { select: { messages: true } } },
    }),
    prisma.supportTicket.count({ where: { restaurantId, status: { in: ["OPEN", "PENDING"] } } }),
  ]);

  return {
    total,
    rows,
    openCount,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** A single ticket, scoped — returns null if it isn't this restaurant's. */
export async function getTicketForRestaurant(restaurantId: string, id: string) {
  return prisma.supportTicket.findFirst({
    where: { id, restaurantId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

/** Open a new support ticket for a restaurant (first message from the owner). */
export async function createTicketForRestaurant(input: {
  restaurantId: string;
  subject: string;
  requesterName: string;
  requesterEmail: string;
  body: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}) {
  return prisma.supportTicket.create({
    data: {
      restaurantId: input.restaurantId,
      subject: input.subject,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      priority: input.priority ?? "NORMAL",
      status: "OPEN",
      messages: {
        create: { authorType: "OWNER", authorName: input.requesterName, body: input.body },
      },
    },
    select: { id: true },
  });
}

/**
 * Append an owner reply to a ticket and move it back to OPEN (awaiting the
 * platform). Scoped — no-op returning null if the ticket isn't this restaurant's
 * or has been resolved/closed.
 */
export async function ownerReplyToTicket(
  restaurantId: string,
  ticketId: string,
  authorName: string,
  body: string
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, restaurantId },
    select: { id: true, status: true },
  });
  if (!ticket || ticket.status === "CLOSED") return null;

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, authorType: "OWNER", authorName, body },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "OPEN", lastMessageAt: new Date() },
    }),
  ]);
  return message;
}

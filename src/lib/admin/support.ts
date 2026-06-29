import type { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Support ticket data for the admin Support module. */

export async function listTickets(filters: {
  status?: TicketStatus | "ALL";
  search?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const { status = "ALL", search, page = 1, perPage = 20 } = filters;
  const where: Prisma.SupportTicketWhereInput = {};
  if (status !== "ALL") where.status = status;
  if (search?.trim()) {
    const q = search.trim();
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { requesterName: { contains: q, mode: "insensitive" } },
      { requesterEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows, openCount, pendingCount] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ lastMessageAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        restaurant: { select: { name: true, slug: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { status: "PENDING" } }),
  ]);

  return {
    total,
    rows,
    openCount,
    pendingCount,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getTicket(id: string) {
  return prisma.supportTicket.findUnique({
    where: { id },
    include: {
      restaurant: { select: { id: true, name: true, slug: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

/** Append an admin reply and move the ticket to PENDING (awaiting requester). */
export async function replyToTicket(
  ticketId: string,
  authorName: string,
  body: string,
  now: Date = new Date()
) {
  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({
      data: { ticketId, authorType: "ADMIN", authorName, body },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "PENDING", lastMessageAt: now },
    }),
  ]);
  return message;
}

export async function setTicketStatus(id: string, status: TicketStatus) {
  return prisma.supportTicket.update({ where: { id }, data: { status } });
}

/** Create a ticket (used by the tenant/public side and tests). */
export async function createTicket(input: {
  subject: string;
  requesterName: string;
  requesterEmail: string;
  body: string;
  restaurantId?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}) {
  return prisma.supportTicket.create({
    data: {
      subject: input.subject,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      restaurantId: input.restaurantId ?? null,
      priority: input.priority ?? "NORMAL",
      messages: {
        create: {
          authorType: "OWNER",
          authorName: input.requesterName,
          body: input.body,
        },
      },
    },
    include: { messages: true },
  });
}

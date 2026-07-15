"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  createTicketForRestaurant,
  ownerReplyToTicket,
} from "@/lib/support/tenant";
import { createTicketSchema, ticketReplySchema } from "@/lib/validations/support";

/** The signed-in owner/staff member's display identity for a ticket. */
async function requester(userId: string, fallbackEmail: string, fallbackName: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  return {
    name: user?.name || fallbackName,
    email: user?.email || fallbackEmail,
  };
}

export async function createSupportTicket(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { userId, restaurantId, restaurantName } = await requireTenant();
  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }

  const who = await requester(userId, `owner@${restaurantName}`, restaurantName);
  const ticket = await createTicketForRestaurant({
    restaurantId,
    subject: parsed.data.subject,
    priority: parsed.data.priority,
    body: parsed.data.body,
    requesterName: who.name,
    requesterEmail: who.email,
  });

  revalidatePath("/dashboard/support");
  return actionOk({ id: ticket.id });
}

export async function replySupportTicket(input: unknown): Promise<ActionResult> {
  const { userId, restaurantId, restaurantName } = await requireTenant();
  const parsed = ticketReplySchema.safeParse(input);
  if (!parsed.success) return actionError("Write a reply first");

  const who = await requester(userId, `owner@${restaurantName}`, restaurantName);
  const message = await ownerReplyToTicket(
    restaurantId,
    parsed.data.ticketId,
    who.name,
    parsed.data.body
  );
  if (!message) return actionError("This ticket can no longer be replied to.");

  revalidatePath(`/dashboard/support/${parsed.data.ticketId}`);
  revalidatePath("/dashboard/support");
  return actionOk();
}

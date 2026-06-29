"use server";

import { revalidatePath } from "next/cache";
import type { TicketStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/auth";
import { replyToTicket, setTicketStatus } from "@/lib/admin/support";
import { ticketReplySchema, ticketStatusSchema } from "@/lib/validations/admin";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";

export async function replyToTicketAction(input: {
  ticketId: string;
  body: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = ticketReplySchema.safeParse(input);
  if (!parsed.success) return actionError("Enter a message.");
  await replyToTicket(parsed.data.ticketId, admin.name, parsed.data.body);
  revalidatePath(`/admin/support/${parsed.data.ticketId}`);
  revalidatePath("/admin/support");
  return actionOk();
}

export async function setTicketStatusAction(input: {
  ticketId: string;
  status: TicketStatus;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ticketStatusSchema.safeParse(input);
  if (!parsed.success) return actionError("Invalid status.");
  await setTicketStatus(parsed.data.ticketId, parsed.data.status);
  revalidatePath(`/admin/support/${parsed.data.ticketId}`);
  revalidatePath("/admin/support");
  return actionOk();
}

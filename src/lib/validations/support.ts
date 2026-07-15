import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Give your ticket a subject").max(160),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  body: z.string().trim().min(10, "Tell us a bit more (at least 10 characters)").max(5000),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const ticketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Write a reply").max(5000),
});
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;

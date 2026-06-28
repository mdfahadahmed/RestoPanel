import { z } from "zod";

export const replyReviewSchema = z.object({
  id: z.string().min(1),
  reply: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const toggleReviewSchema = z.object({
  id: z.string().min(1),
  isPublished: z.boolean(),
});

export const createReviewSchema = z.object({
  orderNumber: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1, "Pick a rating").max(5),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  name: z.string().trim().max(120).optional().or(z.literal("")),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

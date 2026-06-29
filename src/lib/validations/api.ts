import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
  variant: z.object({ name: z.string() }).optional(),
  extras: z.array(z.object({ name: z.string() })).default([]),
});

export const apiCreateOrderSchema = z.object({
  type: z.enum(["DELIVERY", "PICKUP", "DINE_IN"]).default("PICKUP"),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(3).max(40),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    address: z.string().trim().max(300).optional().or(z.literal("")),
  }),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  paymentMethod: z.enum(["CASH", "CARD", "ONLINE"]).default("CASH"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ApiCreateOrderInput = z.infer<typeof apiCreateOrderSchema>;

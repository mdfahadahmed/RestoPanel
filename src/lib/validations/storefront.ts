import { z } from "zod";
import { orderItemInputSchema, orderTypeEnum, paymentMethodEnum } from "./order";

const phone = z
  .string()
  .trim()
  .min(3, "Phone is required")
  .max(40)
  .regex(/^[0-9+()\-\s]+$/, "Enter a valid phone number");

export const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(1, "Name is required").max(120),
    customerPhone: phone,
    customerEmail: z.string().trim().email("Invalid email").max(160).optional().or(z.literal("")),
    address: z.string().trim().max(400).optional().or(z.literal("")),
    type: orderTypeEnum.default("DELIVERY"),
    paymentMethod: paymentMethodEnum.default("CASH"),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    couponCode: z.string().trim().max(32).optional().or(z.literal("")),
    items: z.array(orderItemInputSchema).min(1, "Your cart is empty").max(100),
  })
  .superRefine((data, ctx) => {
    if (data.type === "DELIVERY" && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["address"],
        message: "Delivery address is required",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const reservationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone,
  email: z.string().trim().email("Invalid email").max(160).optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  partySize: z.coerce.number().int().min(1, "At least 1").max(50, "Max 50"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ReservationInput = z.infer<typeof reservationSchema>;

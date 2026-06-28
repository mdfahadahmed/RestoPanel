import { z } from "zod";

export const customerStatusEnum = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]);
export type CustomerStatus = z.infer<typeof customerStatusEnum>;

const tagSchema = z.string().trim().min(1).max(40);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(3, "Phone is required")
    .max(40)
    .regex(/^[0-9+()\-\s]+$/, "Enter a valid phone number"),
  email: z.string().trim().email("Invalid email").max(160).optional().or(z.literal("")),
  address: z.string().trim().max(400).optional().or(z.literal("")),
  status: customerStatusEnum.default("ACTIVE"),
  tags: z.array(tagSchema).max(20).default([]),
});

export const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().min(1),
});

export const setStatusSchema = z.object({
  id: z.string().min(1),
  status: customerStatusEnum,
});

export const setTagsSchema = z.object({
  id: z.string().min(1),
  tags: z.array(tagSchema).max(20),
});

export const addNoteSchema = z.object({
  customerId: z.string().min(1),
  body: z.string().trim().min(1, "Note can't be empty").max(2000),
});

export const updateNoteSchema = z.object({
  id: z.string().min(1),
  body: z.string().trim().min(1, "Note can't be empty").max(2000),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

import { z } from "zod";

// --- Auth --------------------------------------------------------------------
export const customerRegisterSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;

export const customerLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

// --- Profile -----------------------------------------------------------------
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  avatarUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  avatarKey: z.string().trim().max(300).optional().or(z.literal("")),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// --- Settings ----------------------------------------------------------------
export const updateSettingsSchema = z.object({
  language: z.enum(["en", "fr", "es", "de"]).default("en"),
  theme: z.enum(["dark", "light"]).default("dark"),
  notifyOrderUpdates: z.boolean().default(true),
  notifyPromotions: z.boolean().default(true),
  notifyRestaurantMsgs: z.boolean().default(true),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// --- Addresses ---------------------------------------------------------------
export const addressSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(40).default("Home"),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  line1: z.string().trim().min(3, "Address line is required").max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(120),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  postalCode: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

// --- Order list query --------------------------------------------------------
export const ORDER_SORTS = ["date_desc", "date_asc", "total_desc", "total_asc"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export const orderListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().optional(),
  restaurantId: z.string().trim().optional(),
  sort: z.enum(ORDER_SORTS).default("date_desc"),
  page: z.coerce.number().int().min(1).default(1),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

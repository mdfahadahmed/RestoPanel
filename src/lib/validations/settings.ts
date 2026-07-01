import { z } from "zod";

const optionalStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const hex = z.string().regex(/^#([0-9a-fA-F]{6})$/, "Use a hex colour like #E8C372");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const daySchema = z
  .object({ open: timeStr, close: timeStr })
  .nullable(); // null = closed

export const openingHoursSchema = z.object({
  mon: daySchema,
  tue: daySchema,
  wed: daySchema,
  thu: daySchema,
  fri: daySchema,
  sat: daySchema,
  sun: daySchema,
});

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(80),
});

export const temporaryClosureSchema = z.object({
  enabled: z.boolean().default(false),
  message: optionalStr(280),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export const updateSettingsSchema = z.object({
  // General
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: z.string().trim().min(2, "Slug is too short").max(60).regex(SLUG_RE, "Use lowercase letters, numbers and hyphens"),
  description: optionalStr(2000),
  shortDescription: optionalStr(300),
  logoUrl: optionalStr(2048),
  logoKey: optionalStr(512),
  coverImageUrl: optionalStr(2048),
  coverKey: optionalStr(512),

  // Contact
  email: z.string().trim().email("Invalid email").max(160).optional().or(z.literal("")),
  phone: optionalStr(40),
  whatsapp: optionalStr(40),
  website: z.string().trim().url("Invalid URL").max(200).optional().or(z.literal("")),

  // Address
  street: optionalStr(200),
  city: optionalStr(120),
  state: optionalStr(120),
  postalCode: optionalStr(40),
  country: optionalStr(120),

  // Hours
  openingHours: openingHoursSchema,
  holidays: z.array(holidaySchema).max(60).default([]),
  temporaryClosure: temporaryClosureSchema,

  // Ordering
  deliveryEnabled: z.boolean().default(true),
  deliveryRadius: z.coerce.number().int().min(0).max(500).optional().nullable(),
  deliveryFee: z.coerce.number().min(0).max(100000).default(0),
  minimumOrder: z.coerce.number().min(0).max(100000).default(0),
  pickupEnabled: z.boolean().default(true),
  dineInEnabled: z.boolean().default(true),

  // Taxes
  taxName: z.string().trim().min(1).max(40).default("Tax"),
  taxRate: z.coerce.number().min(0, "0–100").max(100, "0–100").default(0),

  // Payments
  onlinePaymentsEnabled: z.boolean().default(false),
  codEnabled: z.boolean().default(true),
  paymentProvider: z.enum(["stripe", "paypal"]).default("stripe"),

  // Localization
  currency: z.string().trim().min(2).max(8).default("GBP"),
  currencySymbol: z.string().trim().min(1).max(4).default("£"),
  timezone: z.string().trim().min(1).max(60).default("Europe/London"),

  // Social
  facebookUrl: z.string().trim().url("Invalid URL").max(200).optional().or(z.literal("")),
  instagramUrl: z.string().trim().url("Invalid URL").max(200).optional().or(z.literal("")),
  tiktokUrl: z.string().trim().url("Invalid URL").max(200).optional().or(z.literal("")),
  twitterUrl: z.string().trim().url("Invalid URL").max(200).optional().or(z.literal("")),

  // SEO
  metaTitle: optionalStr(70),
  metaDescription: optionalStr(160),
  ogImageUrl: optionalStr(2048),
  ogImageKey: optionalStr(512),

  // Theme
  primaryColor: hex,
  secondaryColor: hex,
  themePreset: z.enum(["midnight", "classic", "warm"]).default("midnight"),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type OpeningHoursValue = z.infer<typeof openingHoursSchema>;
export type HolidayValue = z.infer<typeof holidaySchema>;
export type TemporaryClosureValue = z.infer<typeof temporaryClosureSchema>;

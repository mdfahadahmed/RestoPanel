import { z } from "zod";

// ---------------------------------------------------------------------------
// Admin auth
// ---------------------------------------------------------------------------
export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------
export const planSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes")
    .max(60),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  priceMonthly: z.coerce.number().min(0).max(100000),
  priceYearly: z.coerce.number().min(0).max(1000000),
  currency: z.string().trim().length(3).default("GBP"),
  features: z.array(z.string().trim().min(1)).max(30).default([]),
  trialDays: z.coerce.number().int().min(0).max(365).default(14),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  position: z.coerce.number().int().min(0).max(999).default(0),
});
export type PlanInput = z.infer<typeof planSchema>;

// ---------------------------------------------------------------------------
// Restaurant moderation
// ---------------------------------------------------------------------------
export const suspendRestaurantSchema = z.object({
  restaurantId: z.string().min(1),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------
export const ticketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Message is required").max(5000),
});

export const ticketStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]),
});

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------
export const faqSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(300),
  answer: z.string().trim().min(1, "Answer is required").max(3000),
  category: z.string().trim().min(1).max(60).default("General"),
  position: z.coerce.number().int().min(0).max(999).default(0),
  isPublished: z.boolean().default(true),
});

export const blogPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes")
    .max(120),
  excerpt: z.string().trim().max(300).optional().or(z.literal("")),
  content: z.string().max(50000).default(""),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
  author: z.string().trim().min(1).max(80).default("RestoPanel"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});

export const cmsPageSchema = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(160),
  // Free-form JSON content for the page; validated loosely.
  content: z.record(z.unknown()).default({}),
});

// ---------------------------------------------------------------------------
// Platform settings (integration blobs are intentionally permissive)
// ---------------------------------------------------------------------------
export const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(80).default("RestoPanel"),
  supportEmail: z.string().trim().email().optional().or(z.literal("")),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  faviconUrl: z.string().trim().url().optional().or(z.literal("")),

  smtp: z
    .object({
      host: z.string().trim().max(200).optional().or(z.literal("")),
      port: z.coerce.number().int().min(0).max(65535).optional(),
      user: z.string().trim().max(200).optional().or(z.literal("")),
      password: z.string().max(300).optional().or(z.literal("")),
      fromEmail: z.string().trim().max(200).optional().or(z.literal("")),
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),

  cloudinary: z
    .object({
      cloudName: z.string().trim().max(200).optional().or(z.literal("")),
      apiKey: z.string().trim().max(200).optional().or(z.literal("")),
      apiSecret: z.string().max(300).optional().or(z.literal("")),
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),

  stripe: z
    .object({
      publishableKey: z.string().trim().max(300).optional().or(z.literal("")),
      secretKey: z.string().max(300).optional().or(z.literal("")),
      webhookSecret: z.string().max(300).optional().or(z.literal("")),
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),

  sms: z
    .object({
      provider: z.string().trim().max(60).optional().or(z.literal("")),
      accountSid: z.string().trim().max(200).optional().or(z.literal("")),
      authToken: z.string().max(300).optional().or(z.literal("")),
      fromNumber: z.string().trim().max(40).optional().or(z.literal("")),
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),

  resend: z
    .object({
      apiKey: z.string().max(300).optional().or(z.literal("")),
      fromEmail: z.string().trim().max(200).optional().or(z.literal("")),
      fromName: z.string().trim().max(120).optional().or(z.literal("")),
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),

  googleMaps: z
    .object({
      apiKey: z.string().trim().max(300).optional().or(z.literal("")),
      enabled: z.boolean().default(false),
    })
    .default({ enabled: false }),
});
export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;

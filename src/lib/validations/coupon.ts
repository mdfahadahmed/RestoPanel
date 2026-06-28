import { z } from "zod";

export const couponTypeEnum = z.enum(["PERCENTAGE", "FIXED"]);
export type CouponType = z.infer<typeof couponTypeEnum>;

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Code is too short")
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - or _"),
    type: couponTypeEnum.default("PERCENTAGE"),
    value: z.coerce.number().min(0.01, "Must be greater than 0").max(1000000),
    minimumOrder: z.coerce.number().min(0).max(1000000).default(0),
    usageLimit: z.coerce.number().int().min(1).max(1000000).optional().nullable(),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENTAGE" && data.value > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentage can't exceed 100" });
    }
    if (data.startsAt && data.endsAt && data.startsAt > data.endsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End date must be after start date" });
    }
  });

export const updateCouponSchema = z.object({ id: z.string().min(1) }).and(createCouponSchema);

export const couponCodeSchema = z.object({
  code: z.string().trim().min(1).max(32),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;

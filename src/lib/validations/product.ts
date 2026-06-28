import { z } from "zod";

// Shared sub-shapes -----------------------------------------------------------

export const productImageSchema = z.object({
  url: z.string().min(1),
  key: z.string().min(1),
});

// A single purchasable variant (e.g. "Large", "Spicy", "330ml"). Each variant
// can nudge the price, carry its own stock count and SKU.
export const variantSchema = z.object({
  name: z.string().trim().min(1, "Variant name required").max(60),
  priceAdjustment: z.coerce.number().min(-100000).max(100000).default(0),
  stock: z.coerce.number().int().min(0).max(1000000).optional().nullable(),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
});

export const extraSchema = z.object({
  name: z.string().trim().min(1, "Extra name required").max(60),
  price: z.coerce.number().min(0).max(100000).default(0),
  isActive: z.boolean().default(true),
});

export const stockStatusEnum = z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]);
export const productStatusEnum = z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]);

// Product ---------------------------------------------------------------------

const productObject = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  shortDescription: z.string().trim().max(300).optional().or(z.literal("")),
  categoryId: z.string().min(1).optional().nullable(),

  images: z.array(productImageSchema).max(10, "Up to 10 images").default([]),

  price: z.coerce
    .number({ invalid_type_error: "Price is required" })
    .min(0, "Price must be 0 or more")
    .max(1000000),
  comparePrice: z.coerce.number().min(0).max(1000000).optional().nullable(),
  costPrice: z.coerce.number().min(0).max(1000000).optional().nullable(),
  discount: z.coerce.number().min(0, "0–100").max(100, "0–100").default(0),

  sku: z.string().trim().max(60).optional().or(z.literal("")),
  barcode: z.string().trim().max(60).optional().or(z.literal("")),
  calories: z.coerce.number().int().min(0).max(100000).optional().nullable(),
  stockQuantity: z.coerce.number().int().min(0).max(1000000).optional().nullable(),
  stockStatus: stockStatusEnum.default("IN_STOCK"),

  status: productStatusEnum.default("ACTIVE"),
  isAvailable: z.boolean().default(true),
  featured: z.boolean().default(false),
  bestSeller: z.boolean().default(false),

  prepTimeMins: z.coerce.number().int().min(0).max(600).optional().nullable(),
  ingredients: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  extras: z.array(extraSchema).max(50).default([]),
  variants: z.array(variantSchema).max(50).default([]),
});

// Cross-field price rules shared by create + update.
function refineProduct(
  data: z.infer<typeof productObject>,
  ctx: z.RefinementCtx
) {
  if (data.comparePrice != null && data.comparePrice > 0 && data.comparePrice < data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["comparePrice"],
      message: "Compare price should be higher than the price",
    });
  }
}

export const createProductSchema = productObject.superRefine(refineProduct);

export const updateProductSchema = productObject
  .extend({ id: z.string().min(1) })
  .superRefine(refineProduct);

export const quickUpdateSchema = z.object({
  id: z.string().min(1),
  isAvailable: z.boolean().optional(),
  featured: z.boolean().optional(),
  bestSeller: z.boolean().optional(),
  status: productStatusEnum.optional(),
  stockStatus: stockStatusEnum.optional(),
});

export type ProductImage = z.infer<typeof productImageSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Extra = z.infer<typeof extraSchema>;
export type ProductStatus = z.infer<typeof productStatusEnum>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

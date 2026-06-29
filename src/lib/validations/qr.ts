import { z } from "zod";

export const createQrSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(80),
    type: z.enum(["MENU", "TABLE", "DYNAMIC"]),
    tableNumber: z.coerce.number().int().min(1).max(9999).optional(),
    targetPath: z.string().trim().max(300).optional().or(z.literal("")),
    isDynamic: z.boolean().default(false),
    logoEnabled: z.boolean().default(true),
  })
  .refine((d) => d.type !== "TABLE" || d.tableNumber != null, {
    message: "Table number is required for a table QR",
    path: ["tableNumber"],
  });
export type CreateQrInput = z.infer<typeof createQrSchema>;

export const updateQrSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(80).optional(),
  tableNumber: z.coerce.number().int().min(1).max(9999).optional(),
  targetPath: z.string().trim().max(300).optional().or(z.literal("")),
  isDynamic: z.boolean().optional(),
  logoEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// A DYNAMIC target must stay on this platform (a relative path). Prevents using
// the redirect as an open redirector to arbitrary external sites.
export function isSafeTargetPath(path: string): boolean {
  const p = path.trim();
  if (!p) return true; // empty → defaults to storefront home
  return p.startsWith("/") && !p.startsWith("//");
}

import { z } from "zod";

export const registerSchema = z
  .object({
    restaurantName: z.string().trim().min(2, "Restaurant name is too short").max(120),
    ownerName: z.string().trim().min(2, "Owner name is too short").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    phone: z.string().trim().min(6, "Enter a valid phone number").max(40),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

import { z } from "zod";

export const mobilePlatformEnum = z.enum(["IOS", "ANDROID", "WEB"]);

export const mobileLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  platform: mobilePlatformEnum.optional(),
  deviceName: z.string().trim().max(120).optional(),
  pushToken: z.string().trim().max(400).optional(),
  // Two-factor step-up: a TOTP code or a single-use backup code.
  twoFactorCode: z.string().trim().max(20).optional(),
});

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const registerDeviceSchema = z.object({
  pushToken: z.string().trim().min(1, "Push token is required").max(400),
  platform: mobilePlatformEnum.optional(),
});

export const pushTestSchema = z.object({
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(400).optional(),
});

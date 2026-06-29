import { prisma } from "@/lib/prisma";
import type { PlatformSettingsInput } from "@/lib/validations/admin";

const SINGLETON_ID = "singleton";

/** Read the global platform settings, creating the singleton row if missing. */
export async function getPlatformSettings() {
  const existing = await prisma.platformSettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (existing) return existing;
  return prisma.platformSettings.create({ data: { id: SINGLETON_ID } });
}

export async function savePlatformSettings(input: PlatformSettingsInput) {
  const data = {
    platformName: input.platformName,
    supportEmail: input.supportEmail || null,
    logoUrl: input.logoUrl || null,
    faviconUrl: input.faviconUrl || null,
    smtp: input.smtp as object,
    cloudinary: input.cloudinary as object,
    stripe: input.stripe as object,
    sms: input.sms as object,
    resend: input.resend as object,
    googleMaps: input.googleMaps as object,
  };
  return prisma.platformSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}

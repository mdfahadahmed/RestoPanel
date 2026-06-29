import { prisma } from "@/lib/prisma";

/**
 * Provider configuration for the Notification Center. Read from the admin
 * PlatformSettings (singleton) with env-var fallbacks. Returns null when a
 * channel is not configured — callers then log the notification as SKIPPED
 * instead of attempting a network call, so everything works offline/in tests.
 */

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

async function platformBlobs() {
  const row = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { resend: true, sms: true },
  });
  return {
    resend: (row?.resend ?? {}) as Record<string, unknown>,
    sms: (row?.sms ?? {}) as Record<string, unknown>,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function getEmailConfig(): Promise<EmailConfig | null> {
  const { resend } = await platformBlobs();

  const apiKey = str(resend.apiKey) || process.env.RESEND_API_KEY || "";
  const fromEmail =
    str(resend.fromEmail) || process.env.RESEND_FROM_EMAIL || "";
  const fromName = str(resend.fromName) || "RestoPanel";

  // Explicitly disabled in settings (and no env override) → off.
  if (resend.enabled === false && !process.env.RESEND_API_KEY) return null;
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail, fromName };
}

export async function getSmsConfig(): Promise<SmsConfig | null> {
  const { sms } = await platformBlobs();

  const accountSid = str(sms.accountSid) || process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = str(sms.authToken) || process.env.TWILIO_AUTH_TOKEN || "";
  const fromNumber = str(sms.fromNumber) || process.env.TWILIO_FROM_NUMBER || "";

  if (sms.enabled === false && !process.env.TWILIO_ACCOUNT_SID) return null;
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

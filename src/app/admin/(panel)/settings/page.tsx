import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { getPlatformSettings } from "@/lib/admin/settings";
import { SettingsForm, type SettingsState } from "./SettingsForm";

export const dynamic = "force-dynamic";

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return v == null ? "" : String(v);
}
function bool(v: unknown): boolean {
  return v === true;
}

export default async function PlatformSettingsPage() {
  // Integration secrets are SUPER_ADMIN-only.
  await requireSuperAdmin();
  const settings = await getPlatformSettings();

  const smtp = obj(settings.smtp);
  const cloudinary = obj(settings.cloudinary);
  const stripe = obj(settings.stripe);
  const sms = obj(settings.sms);
  const resend = obj(settings.resend);
  const googleMaps = obj(settings.googleMaps);

  const initial: SettingsState = {
    platformName: settings.platformName,
    supportEmail: str(settings.supportEmail),
    logoUrl: str(settings.logoUrl),
    faviconUrl: str(settings.faviconUrl),
    smtp: {
      host: str(smtp.host),
      port: smtp.port == null ? "" : Number(smtp.port),
      user: str(smtp.user),
      password: str(smtp.password),
      fromEmail: str(smtp.fromEmail),
      enabled: bool(smtp.enabled),
    },
    cloudinary: {
      cloudName: str(cloudinary.cloudName),
      apiKey: str(cloudinary.apiKey),
      apiSecret: str(cloudinary.apiSecret),
      enabled: bool(cloudinary.enabled),
    },
    stripe: {
      publishableKey: str(stripe.publishableKey),
      secretKey: str(stripe.secretKey),
      webhookSecret: str(stripe.webhookSecret),
      enabled: bool(stripe.enabled),
    },
    sms: {
      provider: str(sms.provider),
      accountSid: str(sms.accountSid),
      authToken: str(sms.authToken),
      fromNumber: str(sms.fromNumber),
      enabled: bool(sms.enabled),
    },
    resend: {
      apiKey: str(resend.apiKey),
      fromEmail: str(resend.fromEmail),
      fromName: str(resend.fromName),
      enabled: bool(resend.enabled),
    },
    googleMaps: {
      apiKey: str(googleMaps.apiKey),
      enabled: bool(googleMaps.enabled),
    },
  };

  return (
    <>
      <PageHeader
        title="Platform Settings"
        description="Global integrations and branding for the whole platform."
      />
      <SettingsForm initial={initial} />
    </>
  );
}

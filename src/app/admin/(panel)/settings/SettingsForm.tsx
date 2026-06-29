"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Cloud, CreditCard, MessageSquare, MapPin, Image, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { savePlatformSettingsAction } from "./actions";

export interface SettingsState {
  platformName: string;
  supportEmail: string;
  logoUrl: string;
  faviconUrl: string;
  smtp: { host: string; port: number | ""; user: string; password: string; fromEmail: string; enabled: boolean };
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string; enabled: boolean };
  stripe: { publishableKey: string; secretKey: string; webhookSecret: string; enabled: boolean };
  sms: { provider: string; accountSid: string; authToken: string; fromNumber: string; enabled: boolean };
  resend: { apiKey: string; fromEmail: string; fromName: string; enabled: boolean };
  googleMaps: { apiKey: string; enabled: boolean };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-fog-300">{label}</span>
      {children}
    </label>
  );
}

function SectionCard({
  title,
  icon: Icon,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof Mail;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-fog-400" /> {title}
        </CardTitle>
        <label className="flex items-center gap-2 text-xs text-fog-400">
          {enabled ? "Enabled" : "Disabled"}
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </label>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

export function SettingsForm({ initial }: { initial: SettingsState }) {
  const router = useRouter();
  const [s, setS] = useState<SettingsState>(initial);
  const [pending, setPending] = useState(false);

  function set<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setPending(true);
    try {
      const payload = {
        ...s,
        supportEmail: s.supportEmail,
        smtp: { ...s.smtp, port: s.smtp.port === "" ? undefined : Number(s.smtp.port) },
      };
      const res = await savePlatformSettingsAction(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-4 w-4 text-fog-400" /> Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Platform name">
            <Input value={s.platformName} onChange={(e) => set("platformName", e.target.value)} />
          </Field>
          <Field label="Support email">
            <Input value={s.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} placeholder="support@restopanel.com" />
          </Field>
          <Field label="Logo URL">
            <Input value={s.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.svg" />
          </Field>
          <Field label="Favicon URL">
            <Input value={s.faviconUrl} onChange={(e) => set("faviconUrl", e.target.value)} placeholder="https://…/favicon.ico" />
          </Field>
        </CardContent>
      </Card>

      <SectionCard title="SMTP (email)" icon={Mail} enabled={s.smtp.enabled} onToggle={(v) => set("smtp", { ...s.smtp, enabled: v })}>
        <Field label="Host">
          <Input value={s.smtp.host} onChange={(e) => set("smtp", { ...s.smtp, host: e.target.value })} placeholder="smtp.example.com" />
        </Field>
        <Field label="Port">
          <Input type="number" value={s.smtp.port} onChange={(e) => set("smtp", { ...s.smtp, port: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="587" />
        </Field>
        <Field label="Username">
          <Input value={s.smtp.user} onChange={(e) => set("smtp", { ...s.smtp, user: e.target.value })} />
        </Field>
        <Field label="Password">
          <Input type="password" value={s.smtp.password} onChange={(e) => set("smtp", { ...s.smtp, password: e.target.value })} />
        </Field>
        <Field label="From email">
          <Input value={s.smtp.fromEmail} onChange={(e) => set("smtp", { ...s.smtp, fromEmail: e.target.value })} placeholder="no-reply@restopanel.com" />
        </Field>
      </SectionCard>

      <SectionCard title="Cloudinary (uploads)" icon={Cloud} enabled={s.cloudinary.enabled} onToggle={(v) => set("cloudinary", { ...s.cloudinary, enabled: v })}>
        <Field label="Cloud name">
          <Input value={s.cloudinary.cloudName} onChange={(e) => set("cloudinary", { ...s.cloudinary, cloudName: e.target.value })} />
        </Field>
        <Field label="API key">
          <Input value={s.cloudinary.apiKey} onChange={(e) => set("cloudinary", { ...s.cloudinary, apiKey: e.target.value })} />
        </Field>
        <Field label="API secret">
          <Input type="password" value={s.cloudinary.apiSecret} onChange={(e) => set("cloudinary", { ...s.cloudinary, apiSecret: e.target.value })} />
        </Field>
      </SectionCard>

      <SectionCard title="Stripe (payments)" icon={CreditCard} enabled={s.stripe.enabled} onToggle={(v) => set("stripe", { ...s.stripe, enabled: v })}>
        <Field label="Publishable key">
          <Input value={s.stripe.publishableKey} onChange={(e) => set("stripe", { ...s.stripe, publishableKey: e.target.value })} placeholder="pk_live_…" />
        </Field>
        <Field label="Secret key">
          <Input type="password" value={s.stripe.secretKey} onChange={(e) => set("stripe", { ...s.stripe, secretKey: e.target.value })} placeholder="sk_live_…" />
        </Field>
        <Field label="Webhook secret">
          <Input type="password" value={s.stripe.webhookSecret} onChange={(e) => set("stripe", { ...s.stripe, webhookSecret: e.target.value })} placeholder="whsec_…" />
        </Field>
      </SectionCard>

      <SectionCard title="Resend (email notifications)" icon={Send} enabled={s.resend.enabled} onToggle={(v) => set("resend", { ...s.resend, enabled: v })}>
        <Field label="API key">
          <Input type="password" value={s.resend.apiKey} onChange={(e) => set("resend", { ...s.resend, apiKey: e.target.value })} placeholder="re_…" />
        </Field>
        <Field label="From email">
          <Input value={s.resend.fromEmail} onChange={(e) => set("resend", { ...s.resend, fromEmail: e.target.value })} placeholder="notifications@restopanel.com" />
        </Field>
        <Field label="From name">
          <Input value={s.resend.fromName} onChange={(e) => set("resend", { ...s.resend, fromName: e.target.value })} placeholder="RestoPanel" />
        </Field>
      </SectionCard>

      <SectionCard title="SMS (Twilio)" icon={MessageSquare} enabled={s.sms.enabled} onToggle={(v) => set("sms", { ...s.sms, enabled: v })}>
        <Field label="Provider">
          <Input value={s.sms.provider} onChange={(e) => set("sms", { ...s.sms, provider: e.target.value })} placeholder="twilio" />
        </Field>
        <Field label="Account SID">
          <Input value={s.sms.accountSid} onChange={(e) => set("sms", { ...s.sms, accountSid: e.target.value })} />
        </Field>
        <Field label="Auth token">
          <Input type="password" value={s.sms.authToken} onChange={(e) => set("sms", { ...s.sms, authToken: e.target.value })} />
        </Field>
        <Field label="From number">
          <Input value={s.sms.fromNumber} onChange={(e) => set("sms", { ...s.sms, fromNumber: e.target.value })} placeholder="+44…" />
        </Field>
      </SectionCard>

      <SectionCard title="Google Maps" icon={MapPin} enabled={s.googleMaps.enabled} onToggle={(v) => set("googleMaps", { ...s.googleMaps, enabled: v })}>
        <Field label="API key">
          <Input value={s.googleMaps.apiKey} onChange={(e) => set("googleMaps", { ...s.googleMaps, apiKey: e.target.value })} />
        </Field>
      </SectionCard>

      <div className="sticky bottom-0 flex justify-end border-t border-line bg-ink-950/80 py-3 backdrop-blur">
        <Button variant="primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save all settings"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader, type UploadedImage } from "@/components/dashboard/ImageUploader";
import type {
  OpeningHoursValue,
  HolidayValue,
  TemporaryClosureValue,
} from "@/lib/validations/settings";
import { WeeklyHoursEditor } from "./WeeklyHoursEditor";
import { updateSettings } from "./actions";

export interface SettingsInitial {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  logo: UploadedImage | null;
  cover: UploadedImage | null;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  openingHours: OpeningHoursValue;
  holidays: HolidayValue[];
  temporaryClosure: TemporaryClosureValue;
  deliveryEnabled: boolean;
  deliveryRadius: string;
  deliveryFee: string;
  minimumOrder: string;
  pickupEnabled: boolean;
  dineInEnabled: boolean;
  taxName: string;
  taxRate: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  twitterUrl: string;
  metaTitle: string;
  metaDescription: string;
  og: UploadedImage | null;
  primaryColor: string;
  secondaryColor: string;
  themePreset: "midnight" | "classic" | "warm";
}

type FieldErrors = Record<string, string[] | undefined>;

const CURRENCIES = [
  { code: "GBP", symbol: "£" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "CAD", symbol: "C$" },
];

const TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
];

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsInitial>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  function set<K extends keyof SettingsInitial>(key: K, value: SettingsInitial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  const err = (k: string) => errors[k]?.[0];

  function addHoliday() {
    set("holidays", [...form.holidays, { date: "", name: "" }]);
  }
  function setHoliday(i: number, patch: Partial<HolidayValue>) {
    set("holidays", form.holidays.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  function removeHoliday(i: number) {
    set("holidays", form.holidays.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      shortDescription: form.shortDescription,
      logoUrl: form.logo?.url ?? "",
      logoKey: form.logo?.key ?? "",
      coverImageUrl: form.cover?.url ?? "",
      coverKey: form.cover?.key ?? "",
      email: form.email,
      phone: form.phone,
      whatsapp: form.whatsapp,
      website: form.website,
      street: form.street,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      country: form.country,
      openingHours: form.openingHours,
      holidays: form.holidays.filter((h) => h.date && h.name.trim()),
      temporaryClosure: form.temporaryClosure,
      deliveryEnabled: form.deliveryEnabled,
      deliveryRadius: form.deliveryRadius === "" ? null : Number(form.deliveryRadius),
      deliveryFee: form.deliveryFee === "" ? 0 : Number(form.deliveryFee),
      minimumOrder: form.minimumOrder === "" ? 0 : Number(form.minimumOrder),
      pickupEnabled: form.pickupEnabled,
      dineInEnabled: form.dineInEnabled,
      taxName: form.taxName || "Tax",
      taxRate: form.taxRate === "" ? 0 : Number(form.taxRate),
      currency: form.currency,
      currencySymbol: form.currencySymbol,
      timezone: form.timezone,
      facebookUrl: form.facebookUrl,
      instagramUrl: form.instagramUrl,
      tiktokUrl: form.tiktokUrl,
      twitterUrl: form.twitterUrl,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      ogImageUrl: form.og?.url ?? "",
      ogImageKey: form.og?.key ?? "",
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      themePreset: form.themePreset,
    };

    setPending(true);
    try {
      const res = await updateSettings(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-24">
      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="ordering">Ordering</TabsTrigger>
          <TabsTrigger value="localization">Localization</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="theme">Theme</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Restaurant name" error={err("name")}>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
              </Field>
              <Field label="Site URL (slug)" error={err("slug")} hint={`Your site: /r/${form.slug || "your-slug"}`}>
                <Input value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} maxLength={60} />
              </Field>
              <Field label="Short description" error={err("shortDescription")}>
                <Input value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} maxLength={300} placeholder="One-line tagline" />
              </Field>
              <Field label="Description" error={err("description")}>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Logo</Label>
                  <ImageUploader value={form.logo} onChange={(v) => set("logo", v)} kind="logos" aspect="aspect-square" label="Upload logo" className="max-w-[180px]" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cover image</Label>
                  <ImageUploader value={form.cover} onChange={(v) => set("cover", v)} kind="covers" aspect="aspect-[3/1]" label="Upload cover" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact">
          <Card>
            <CardHeader><CardTitle>Contact & location</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" error={err("email")}><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
                <Field label="Phone" error={err("phone")}><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
                <Field label="WhatsApp" error={err("whatsapp")}><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
                <Field label="Website" error={err("website")}><Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Street" error={err("street")} full><Input value={form.street} onChange={(e) => set("street", e.target.value)} /></Field>
                <Field label="City" error={err("city")}><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
                <Field label="State / Region" error={err("state")}><Input value={form.state} onChange={(e) => set("state", e.target.value)} /></Field>
                <Field label="Postal code" error={err("postalCode")}><Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></Field>
                <Field label="Country" error={err("country")}><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hours */}
        <TabsContent value="hours">
          <Card>
            <CardHeader><CardTitle>Business hours</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <WeeklyHoursEditor value={form.openingHours} onChange={(v) => set("openingHours", v)} />

              <div className="space-y-3 rounded-xl border border-line bg-ink-850 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-fog-200">Temporary closure</p>
                    <p className="text-xs text-fog-500">Pause ordering and show a message to customers.</p>
                  </div>
                  <Switch
                    checked={form.temporaryClosure.enabled}
                    onCheckedChange={(v) => set("temporaryClosure", { ...form.temporaryClosure, enabled: v })}
                  />
                </div>
                {form.temporaryClosure.enabled && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Message">
                      <Input value={form.temporaryClosure.message ?? ""} onChange={(e) => set("temporaryClosure", { ...form.temporaryClosure, message: e.target.value })} placeholder="Closed for refurbishment" />
                    </Field>
                    <Field label="Reopen on (optional)">
                      <Input type="date" value={form.temporaryClosure.until ?? ""} onChange={(e) => set("temporaryClosure", { ...form.temporaryClosure, until: e.target.value })} />
                    </Field>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Holiday schedule</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addHoliday}>
                    <Plus className="h-3.5 w-3.5" /> Add holiday
                  </Button>
                </div>
                {form.holidays.length === 0 ? (
                  <p className="text-xs text-fog-500">No holidays added.</p>
                ) : (
                  form.holidays.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="date" value={h.date} onChange={(e) => setHoliday(i, { date: e.target.value })} className="h-9 w-40" aria-label="Holiday date" />
                      <Input value={h.name} onChange={(e) => setHoliday(i, { name: e.target.value })} className="h-9" placeholder="Holiday name" aria-label="Holiday name" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeHoliday(i)} aria-label="Remove holiday"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ordering */}
        <TabsContent value="ordering">
          <Card>
            <CardHeader><CardTitle>Ordering & taxes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow label="Delivery" hint="Accept delivery orders" checked={form.deliveryEnabled} onChange={(v) => set("deliveryEnabled", v)} />
              {form.deliveryEnabled && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Delivery radius (km)" error={err("deliveryRadius")}><Input type="number" min="0" value={form.deliveryRadius} onChange={(e) => set("deliveryRadius", e.target.value)} /></Field>
                  <Field label="Delivery fee" error={err("deliveryFee")}><Input type="number" min="0" step="0.01" value={form.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)} /></Field>
                  <Field label="Minimum order" error={err("minimumOrder")}><Input type="number" min="0" step="0.01" value={form.minimumOrder} onChange={(e) => set("minimumOrder", e.target.value)} /></Field>
                </div>
              )}
              <ToggleRow label="Pickup / Takeaway" hint="Accept collection orders" checked={form.pickupEnabled} onChange={(v) => set("pickupEnabled", v)} />
              <ToggleRow label="Dine in" hint="Accept dine-in orders" checked={form.dineInEnabled} onChange={(v) => set("dineInEnabled", v)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tax name" error={err("taxName")}><Input value={form.taxName} onChange={(e) => set("taxName", e.target.value)} placeholder="VAT" /></Field>
                <Field label="Tax percentage (%)" error={err("taxRate")}><Input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)} /></Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Localization */}
        <TabsContent value="localization">
          <Card>
            <CardHeader><CardTitle>Localization</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(code) => {
                      const c = CURRENCIES.find((x) => x.code === code);
                      set("currency", code);
                      if (c) set("currencySymbol", c.symbol);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Currency symbol" error={err("currencySymbol")}><Input value={form.currencySymbol} onChange={(e) => set("currencySymbol", e.target.value)} maxLength={4} /></Field>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social */}
        <TabsContent value="social">
          <Card>
            <CardHeader><CardTitle>Social media</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Facebook" error={err("facebookUrl")}><Input value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} placeholder="https://facebook.com/…" /></Field>
              <Field label="Instagram" error={err("instagramUrl")}><Input value={form.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} placeholder="https://instagram.com/…" /></Field>
              <Field label="TikTok" error={err("tiktokUrl")}><Input value={form.tiktokUrl} onChange={(e) => set("tiktokUrl", e.target.value)} placeholder="https://tiktok.com/@…" /></Field>
              <Field label="X (Twitter)" error={err("twitterUrl")}><Input value={form.twitterUrl} onChange={(e) => set("twitterUrl", e.target.value)} placeholder="https://x.com/…" /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo">
          <Card>
            <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Meta title" error={err("metaTitle")} hint={`${form.metaTitle.length}/70`}>
                <Input value={form.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} maxLength={70} />
              </Field>
              <Field label="Meta description" error={err("metaDescription")} hint={`${form.metaDescription.length}/160`}>
                <Textarea value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} rows={3} maxLength={160} />
              </Field>
              <div className="space-y-1.5">
                <Label>Open Graph image</Label>
                <ImageUploader value={form.og} onChange={(v) => set("og", v)} kind="covers" aspect="aspect-[1.91/1]" label="Upload OG image" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme */}
        <TabsContent value="theme">
          <Card>
            <CardHeader><CardTitle>Theme</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="Primary colour" value={form.primaryColor} onChange={(v) => set("primaryColor", v)} error={err("primaryColor")} />
                <ColorField label="Secondary colour" value={form.secondaryColor} onChange={(v) => set("secondaryColor", v)} error={err("secondaryColor")} />
              </div>
              <div className="space-y-1.5">
                <Label>Theme preset</Label>
                <Select value={form.themePreset} onValueChange={(v) => set("themePreset", v as SettingsInitial["themePreset"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="midnight">Midnight (black)</SelectItem>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-950/90 px-5 py-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-5xl items-center justify-end">
          <Button type="submit" disabled={pending}>
            <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, error, hint, full, children }: { label: string; error?: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-fog-500">{hint}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-ink-850 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-fog-200">{label}</p>
        <p className="text-xs text-fog-500">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-ink-900" aria-label={`${label} picker`} />
        <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-9 w-32 font-mono" maxLength={7} />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

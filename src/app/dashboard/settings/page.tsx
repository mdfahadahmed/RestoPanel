import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import type {
  OpeningHoursValue,
  HolidayValue,
  TemporaryClosureValue,
} from "@/lib/validations/settings";
import { SettingsForm, type SettingsInitial } from "./SettingsForm";

export const dynamic = "force-dynamic";

const EMPTY_HOURS: OpeningHoursValue = {
  mon: { open: "09:00", close: "22:00" },
  tue: { open: "09:00", close: "22:00" },
  wed: { open: "09:00", close: "22:00" },
  thu: { open: "09:00", close: "22:00" },
  fri: { open: "09:00", close: "22:00" },
  sat: { open: "09:00", close: "22:00" },
  sun: null,
};

export default async function SettingsPage() {
  const { restaurantId } = await requireTenant();
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!r) {
    return <div className="text-fog-400">Restaurant not found.</div>;
  }

  const initial: SettingsInitial = {
    name: r.name,
    slug: r.slug,
    description: r.description ?? "",
    shortDescription: r.shortDescription ?? "",
    logo: r.logoUrl ? { url: r.logoUrl, key: r.logoKey ?? "" } : null,
    cover: r.coverImageUrl ? { url: r.coverImageUrl, key: r.coverKey ?? "" } : null,
    email: r.email ?? "",
    phone: r.phone ?? "",
    whatsapp: r.whatsapp ?? "",
    website: r.website ?? "",
    street: r.street ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    postalCode: r.postalCode ?? "",
    country: r.country ?? "",
    openingHours: (r.openingHours as unknown as OpeningHoursValue | null) ?? EMPTY_HOURS,
    holidays: (r.holidays as unknown as HolidayValue[] | null) ?? [],
    temporaryClosure: (r.temporaryClosure as unknown as TemporaryClosureValue | null) ?? {
      enabled: false,
      message: "",
      until: "",
    },
    deliveryEnabled: r.deliveryEnabled,
    deliveryRadius: r.deliveryRadius != null ? String(r.deliveryRadius) : "",
    deliveryFee: String(Number(r.deliveryFee)),
    minimumOrder: String(Number(r.minimumOrder)),
    pickupEnabled: r.pickupEnabled,
    dineInEnabled: r.dineInEnabled,
    taxName: r.taxName,
    taxRate: String(Number(r.taxRate)),
    onlinePaymentsEnabled: r.onlinePaymentsEnabled,
    codEnabled: r.codEnabled,
    paymentProvider: (r.paymentProvider === "paypal" ? "paypal" : "stripe") as "stripe" | "paypal",
    currency: r.currency,
    currencySymbol: r.currencySymbol,
    timezone: r.timezone,
    facebookUrl: r.facebookUrl ?? "",
    instagramUrl: r.instagramUrl ?? "",
    tiktokUrl: r.tiktokUrl ?? "",
    twitterUrl: r.twitterUrl ?? "",
    metaTitle: r.metaTitle ?? "",
    metaDescription: r.metaDescription ?? "",
    og: r.ogImageUrl ? { url: r.ogImageUrl, key: r.ogImageKey ?? "" } : null,
    primaryColor: r.primaryColor,
    secondaryColor: r.secondaryColor,
    themePreset: (["midnight", "classic", "warm"].includes(r.themePreset) ? r.themePreset : "midnight") as SettingsInitial["themePreset"],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant settings"
        description="Manage your restaurant profile, hours, ordering and storefront."
        action={
          <Button asChild variant="outline">
            <Link href={`/r/${r.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4" /> View site
            </Link>
          </Button>
        }
      />
      <SettingsForm initial={initial} />
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import { updateSettingsSchema } from "@/lib/validations/settings";

// Compose a single-line address from structured parts (used by the storefront).
function composeAddress(parts: { street?: string; city?: string; state?: string; postalCode?: string; country?: string }): string | null {
  const line = [parts.street, parts.city, parts.state, parts.postalCode, parts.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return line || null;
}

export async function updateSettings(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const { restaurantId } = await requireTenant();
  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;

  // Slug must stay globally unique.
  const slugClash = await prisma.restaurant.findFirst({
    where: { slug: d.slug, id: { not: restaurantId } },
    select: { id: true },
  });
  if (slugClash) {
    return actionError("Please fix the errors below", { slug: ["That URL is already taken"] });
  }

  const blank = (v: string | undefined | null) => (v ? v : null);

  try {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name: d.name,
        slug: d.slug,
        description: blank(d.description),
        shortDescription: blank(d.shortDescription),
        logoUrl: blank(d.logoUrl),
        logoKey: blank(d.logoKey),
        coverImageUrl: blank(d.coverImageUrl),
        coverKey: blank(d.coverKey),

        email: blank(d.email),
        phone: blank(d.phone),
        whatsapp: blank(d.whatsapp),
        website: blank(d.website),

        street: blank(d.street),
        city: blank(d.city),
        state: blank(d.state),
        postalCode: blank(d.postalCode),
        country: blank(d.country),
        address: composeAddress(d),

        openingHours: d.openingHours as unknown as Prisma.InputJsonValue,
        holidays: d.holidays as unknown as Prisma.InputJsonValue,
        temporaryClosure: d.temporaryClosure as unknown as Prisma.InputJsonValue,

        deliveryEnabled: d.deliveryEnabled,
        deliveryRadius: d.deliveryRadius ?? null,
        deliveryFee: new Prisma.Decimal(d.deliveryFee),
        minimumOrder: new Prisma.Decimal(d.minimumOrder),
        pickupEnabled: d.pickupEnabled,
        dineInEnabled: d.dineInEnabled,

        taxName: d.taxName,
        taxRate: new Prisma.Decimal(d.taxRate),

        onlinePaymentsEnabled: d.onlinePaymentsEnabled,
        codEnabled: d.codEnabled,
        paymentProvider: d.paymentProvider,

        currency: d.currency,
        currencySymbol: d.currencySymbol,
        timezone: d.timezone,

        facebookUrl: blank(d.facebookUrl),
        instagramUrl: blank(d.instagramUrl),
        tiktokUrl: blank(d.tiktokUrl),
        twitterUrl: blank(d.twitterUrl),

        metaTitle: blank(d.metaTitle),
        metaDescription: blank(d.metaDescription),
        ogImageUrl: blank(d.ogImageUrl),
        ogImageKey: blank(d.ogImageKey),

        primaryColor: d.primaryColor,
        secondaryColor: d.secondaryColor,
        themePreset: d.themePreset,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return actionError("Please fix the errors below", { slug: ["That URL is already taken"] });
    }
    throw e;
  }

  revalidatePath("/dashboard/settings");
  revalidatePath(`/r/${d.slug}`);
  return actionOk({ slug: d.slug });
}

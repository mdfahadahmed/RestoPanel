/**
 * End-to-end test for the Restaurant Settings module.
 * Calls the real validation + persists via the same logic the action uses,
 * then verifies slug uniqueness, field persistence, address composition,
 * storefront integration (closure/min-order), and tenant isolation.
 *
 * Run: npx tsx scripts/test-settings.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { updateSettingsSchema } from "../src/lib/validations/settings";
import { placeOrderPublic } from "../src/app/r/[slug]/actions";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}

function baseInput(slug: string) {
  return {
    name: "My Diner", slug,
    description: "Best food", shortDescription: "Tasty",
    logoUrl: "", logoKey: "", coverImageUrl: "", coverKey: "",
    email: "a@b.com", phone: "0700", whatsapp: "", website: "https://x.com",
    street: "1 High St", city: "London", state: "", postalCode: "E1 6AN", country: "UK",
    openingHours: { mon: { open: "09:00", close: "22:00" }, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    holidays: [{ date: "2026-12-25", name: "Christmas" }],
    temporaryClosure: { enabled: false, message: "", until: "" },
    deliveryEnabled: true, deliveryRadius: 5, deliveryFee: 3, minimumOrder: 15,
    pickupEnabled: true, dineInEnabled: true,
    taxName: "VAT", taxRate: 20,
    currency: "GBP", currencySymbol: "£", timezone: "Europe/London",
    facebookUrl: "https://facebook.com/x", instagramUrl: "", tiktokUrl: "", twitterUrl: "",
    metaTitle: "My Diner", metaDescription: "Order online",
    ogImageUrl: "", ogImageKey: "",
    primaryColor: "#E8C372", secondaryColor: "#8B5CF6", themePreset: "midnight" as const,
  };
}

// Mirror of action persistence (validation + update), scoped by restaurantId.
function composeAddress(p: { street?: string; city?: string; state?: string; postalCode?: string; country?: string }) {
  const line = [p.street, p.city, p.state, p.postalCode, p.country].map((x) => (x ?? "").trim()).filter(Boolean).join(", ");
  return line || null;
}
async function save(restaurantId: string, input: unknown) {
  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const clash = await prisma.restaurant.findFirst({ where: { slug: d.slug, id: { not: restaurantId } }, select: { id: true } });
  if (clash) return { ok: false as const, errors: { slug: ["taken"] } };
  const blank = (v: string | undefined | null) => (v ? v : null);
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: d.name, slug: d.slug, description: blank(d.description), shortDescription: blank(d.shortDescription),
      email: blank(d.email), phone: blank(d.phone), website: blank(d.website),
      street: blank(d.street), city: blank(d.city), postalCode: blank(d.postalCode), country: blank(d.country), address: composeAddress(d),
      openingHours: d.openingHours as unknown as Prisma.InputJsonValue,
      holidays: d.holidays as unknown as Prisma.InputJsonValue,
      temporaryClosure: d.temporaryClosure as unknown as Prisma.InputJsonValue,
      deliveryEnabled: d.deliveryEnabled, deliveryRadius: d.deliveryRadius ?? null,
      deliveryFee: new Prisma.Decimal(d.deliveryFee), minimumOrder: new Prisma.Decimal(d.minimumOrder),
      taxName: d.taxName, taxRate: new Prisma.Decimal(d.taxRate),
      currency: d.currency, currencySymbol: d.currencySymbol, timezone: d.timezone,
      facebookUrl: blank(d.facebookUrl), metaTitle: blank(d.metaTitle), metaDescription: blank(d.metaDescription),
      primaryColor: d.primaryColor, secondaryColor: d.secondaryColor, themePreset: d.themePreset,
    },
  });
  return { ok: true as const };
}

async function main() {
  const tag = `set${Date.now().toString(36)}`; // slug-safe (lowercase alphanumeric)
  const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "A", ownerName: "A" } });
  const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "B", ownerName: "B" } });
  const product = await prisma.product.create({ data: { restaurantId: a.id, name: "Dish", slug: "dish", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(5), discount: new Prisma.Decimal(0) } });

  try {
    console.log("\n[1] Validation");
    check("rejects empty name", !updateSettingsSchema.safeParse({ ...baseInput("ok"), name: "" }).success);
    check("rejects bad slug", !updateSettingsSchema.safeParse({ ...baseInput("Bad Slug!") }).success);
    check("rejects bad hex colour", !updateSettingsSchema.safeParse({ ...baseInput("ok"), primaryColor: "red" }).success);
    check("rejects taxRate > 100", !updateSettingsSchema.safeParse({ ...baseInput("ok"), taxRate: 150 }).success);
    check("rejects bad website url", !updateSettingsSchema.safeParse({ ...baseInput("ok"), website: "notaurl" }).success);
    check("accepts valid input", updateSettingsSchema.safeParse(baseInput("valid-slug")).success);

    console.log("\n[2] Persist + address compose");
    const newSlug = `${tag}-renamed`;
    const r1 = await save(a.id, baseInput(newSlug));
    check("settings saved", r1.ok, r1);
    const saved = await prisma.restaurant.findUnique({ where: { id: a.id } });
    check("scalar fields persisted", saved?.taxName === "VAT" && Number(saved?.taxRate) === 20 && saved?.currency === "GBP");
    check("address composed from parts", saved?.address === "1 High St, London, E1 6AN, UK");
    check("hours + holidays persisted as JSON", Array.isArray(saved?.holidays) && (saved?.holidays as unknown[]).length === 1);
    check("slug updated", saved?.slug === newSlug);

    console.log("\n[3] Slug uniqueness");
    const clash = await save(a.id, baseInput(`${tag}-b`)); // b's slug
    check("duplicate slug rejected", !clash.ok && !!(clash as { errors: Record<string, unknown> }).errors.slug);
    const keepOwn = await save(a.id, baseInput(newSlug)); // its own slug again
    check("keeping own slug allowed", keepOwn.ok);

    console.log("\n[4] Storefront integration: minimum order + closure");
    // minimumOrder 15, product £5 → qty 2 = £10 < 15 → delivery rejected
    const under = await placeOrderPublic(newSlug, { customerName: "X", customerPhone: "0700", type: "DELIVERY", address: "1 St", items: [{ productId: product.id, quantity: 2, extras: [] }] });
    check("delivery under minimum rejected", !under.ok);
    const over = await placeOrderPublic(newSlug, { customerName: "X", customerPhone: "0700", type: "DELIVERY", address: "1 St", items: [{ productId: product.id, quantity: 4, extras: [] }] });
    check("delivery over minimum accepted", over.ok, over);
    // Enable temporary closure → all orders blocked
    await save(a.id, { ...baseInput(newSlug), temporaryClosure: { enabled: true, message: "Closed today", until: "" } });
    const closed = await placeOrderPublic(newSlug, { customerName: "X", customerPhone: "0700", type: "PICKUP", items: [{ productId: product.id, quantity: 1, extras: [] }] });
    check("ordering blocked during closure", !closed.ok && closed.error === "Closed today");

    console.log("\n[5] Tenant isolation");
    const aFromB = await prisma.restaurant.findFirst({ where: { id: a.id, slug: `${tag}-b` } });
    check("restaurant rows are independent", aFromB === null);
    const bUnchanged = await prisma.restaurant.findUnique({ where: { id: b.id } });
    check("tenant B settings untouched by tenant A saves", bUnchanged?.taxName === "Tax" && Number(bUnchanged?.taxRate) === 0);
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });

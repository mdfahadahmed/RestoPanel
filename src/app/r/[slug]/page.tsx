import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, MapPin, Phone, Mail, Star, ArrowRight, UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRestaurantBySlug, getReviewSummary, DAYS, type OpeningHours } from "@/lib/storefront/data";
import { toStoreProduct } from "@/lib/storefront/product";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { Hero } from "@/components/store/Hero";
import { ProductCard } from "@/components/store/ProductCard";

export const dynamic = "force-dynamic";

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  images: true,
  price: true,
  discount: true,
  featured: true,
  bestSeller: true,
  variants: true,
  extras: true,
} as const;

export default async function StoreHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const base = `/r/${slug}`;
  const availableWhere = { restaurantId: restaurant.id, deletedAt: null, status: "ACTIVE" as const, isAvailable: true };

  const [featured, bestSellers, categories, reviews, reviewSummary] = await Promise.all([
    prisma.product.findMany({ where: { ...availableWhere, featured: true }, take: 8, orderBy: { createdAt: "desc" }, select: CARD_SELECT }),
    prisma.product.findMany({ where: { ...availableWhere, bestSeller: true }, take: 8, orderBy: { createdAt: "desc" }, select: CARD_SELECT }),
    prisma.category.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true, _count: { select: { products: { where: { deletedAt: null, status: "ACTIVE", isAvailable: true } } } } },
    }),
    prisma.review.findMany({ where: { restaurantId: restaurant.id, isPublished: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    getReviewSummary(restaurant.id),
  ]);

  const hours = (restaurant.openingHours as OpeningHours | null) ?? null;
  const mapSrc = restaurant.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(restaurant.address)}&output=embed`
    : null;

  return (
    <div>
      <Hero
        slug={slug}
        name={restaurant.name}
        description={restaurant.description}
        coverImageUrl={restaurant.coverImageUrl}
        logoUrl={restaurant.logoUrl}
        rating={reviewSummary.average}
        reviewCount={reviewSummary.count}
      />

      <div className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:px-6">
        {/* Featured */}
        {featured.length > 0 && (
          <Section title="Featured" subtitle="Hand-picked favourites" href={`${base}/menu`}>
            <Grid>
              {featured.map((p) => (
                <ProductCard key={p.id} slug={slug} product={toStoreProduct(p)} />
              ))}
            </Grid>
          </Section>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <Section title="Explore the menu" subtitle="Browse by category">
            <GsapReveal className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`${base}/menu?category=${c.id}`}
                  className="group rounded-2xl border border-line bg-ink-900/50 p-5 transition hover:border-gold-400/40 hover:bg-ink-900"
                >
                  <UtensilsCrossed className="h-6 w-6 text-gold-300" />
                  <h3 className="mt-3 font-medium text-fog-100">{c.name}</h3>
                  <p className="text-xs text-fog-500">{c._count.products} items</p>
                </Link>
              ))}
            </GsapReveal>
          </Section>
        )}

        {/* Best sellers */}
        {bestSellers.length > 0 && (
          <Section title="Best sellers" subtitle="What everyone's ordering" href={`${base}/menu`}>
            <Grid>
              {bestSellers.map((p) => (
                <ProductCard key={p.id} slug={slug} product={toStoreProduct(p)} />
              ))}
            </Grid>
          </Section>
        )}

        {/* About + hours */}
        <div className="grid gap-8 lg:grid-cols-2">
          <GsapReveal className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-fog-50">About {restaurant.name}</h2>
            <p className="text-pretty leading-relaxed text-fog-300">
              {restaurant.description ??
                `Welcome to ${restaurant.name}. We serve fresh, delicious food made to order — available for delivery, takeaway and dine in.`}
            </p>
            <Link href={`${base}/about`} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-300 hover:text-gold-200">
              Learn more <ArrowRight className="h-4 w-4" />
            </Link>
          </GsapReveal>

          {hours && (
            <div className="rounded-2xl border border-line bg-ink-900/50 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-fog-100">
                <Clock className="h-4 w-4 text-gold-300" /> Opening hours
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                {DAYS.map((d) => {
                  const slot = hours[d.key];
                  return (
                    <li key={d.key} className="flex items-center justify-between border-b border-line/60 pb-2 last:border-0">
                      <span className="text-fog-300">{d.label}</span>
                      <span className="text-fog-400">{slot ? `${slot.open} – ${slot.close}` : "Closed"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Reviews */}
        <Section title="Customer reviews" subtitle={reviewSummary.count > 0 ? `${reviewSummary.average.toFixed(1)} average from ${reviewSummary.count} reviews` : "Be the first to review"}>
          {reviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-ink-900/40 p-8 text-center text-sm text-fog-500">
              No reviews yet — check back soon.
            </p>
          ) : (
            <GsapReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-line bg-ink-900/50 p-5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-gold-400 text-gold-400" : "text-fog-700"}`} />
                    ))}
                  </div>
                  {r.comment && <p className="mt-3 text-sm text-fog-300">“{r.comment}”</p>}
                  <p className="mt-3 text-xs font-medium text-fog-500">— {r.customerName}</p>
                </div>
              ))}
            </GsapReveal>
          )}
        </Section>

        {/* Contact + map */}
        <Section title="Find us" subtitle="Get in touch or visit us">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-line bg-ink-900/50 p-6 text-sm">
              {restaurant.address && <ContactRow icon={MapPin} value={restaurant.address} />}
              {restaurant.phone && <ContactRow icon={Phone} value={restaurant.phone} />}
              {restaurant.email && <ContactRow icon={Mail} value={restaurant.email} />}
              <Link href={`${base}/contact`} className="inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-gold-300 hover:text-gold-200">
                Contact page <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {mapSrc ? (
              <iframe
                title="Map"
                src={mapSrc}
                loading="lazy"
                className="h-72 w-full rounded-2xl border border-line"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="grid h-72 place-items-center rounded-2xl border border-line bg-ink-900/40 text-sm text-fog-600">
                Location coming soon
              </div>
            )}
          </div>
        </Section>

        {/* CTA */}
        <div className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-ink-900 to-ink-950 p-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-fog-50">Hungry? Order in minutes.</h2>
          <p className="mx-auto mt-2 max-w-md text-fog-400">Browse the full menu and check out for delivery, takeaway or dine in.</p>
          <Link
            href={`${base}/menu`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold-400 px-7 py-3 font-medium text-ink-950 transition hover:bg-gold-300"
          >
            Start your order <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, href, children }: { title: string; subtitle?: string; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-fog-50">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-fog-400">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-medium text-gold-300 hover:text-gold-200">
            View all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <GsapReveal className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{children}</GsapReveal>;
}

function ContactRow({ icon: Icon, value }: { icon: typeof MapPin; value: string }) {
  return (
    <div className="flex items-start gap-2 text-fog-200">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fog-500" />
      <span>{value}</span>
    </div>
  );
}

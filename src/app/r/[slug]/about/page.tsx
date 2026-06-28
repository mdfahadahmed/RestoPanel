import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Clock, ArrowRight } from "lucide-react";
import { getRestaurantBySlug, DAYS, type OpeningHours } from "@/lib/storefront/data";
import { GsapReveal } from "@/components/dashboard/GsapReveal";

export const dynamic = "force-dynamic";

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const hours = (restaurant.openingHours as OpeningHours | null) ?? null;

  return (
    <div>
      {restaurant.coverImageUrl && (
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          <Image src={restaurant.coverImageUrl} alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 to-transparent" />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <GsapReveal className="space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-fog-50">About {restaurant.name}</h1>
          <p className="text-pretty text-lg leading-relaxed text-fog-300">
            {restaurant.description ??
              `Welcome to ${restaurant.name}. We're passionate about serving fresh, delicious food made to order. Whether you're here for delivery, takeaway or a relaxed dine-in experience, we'd love to have you.`}
          </p>

          {hours && (
            <div className="rounded-2xl border border-line bg-ink-900/50 p-6">
              <h2 className="flex items-center gap-2 font-semibold text-fog-100">
                <Clock className="h-4 w-4 text-gold-300" /> Opening hours
              </h2>
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

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/r/${slug}/menu`} className="inline-flex items-center gap-2 rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 hover:bg-gold-300">
              View menu <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={`/r/${slug}/reservation`} className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-900 px-6 py-3 font-medium text-fog-100 hover:bg-ink-800">
              Book a table
            </Link>
          </div>
        </GsapReveal>
      </div>
    </div>
  );
}

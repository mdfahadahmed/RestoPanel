import { notFound } from "next/navigation";
import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { getRestaurantBySlug, DAYS, type OpeningHours } from "@/lib/storefront/data";
import { GsapReveal } from "@/components/dashboard/GsapReveal";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const hours = (restaurant.openingHours as OpeningHours | null) ?? null;
  const mapSrc = restaurant.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(restaurant.address)}&output=embed`
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight text-fog-50">Contact us</h1>
      <p className="mt-2 text-fog-400">We&apos;d love to hear from you.</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <GsapReveal className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-line bg-ink-900/50 p-6 text-sm">
            {restaurant.phone && <Row icon={Phone} label="Phone" value={restaurant.phone} href={`tel:${restaurant.phone}`} />}
            {restaurant.email && <Row icon={Mail} label="Email" value={restaurant.email} href={`mailto:${restaurant.email}`} />}
            {restaurant.address && <Row icon={MapPin} label="Address" value={restaurant.address} />}
            {!restaurant.phone && !restaurant.email && !restaurant.address && (
              <p className="text-fog-500">Contact details coming soon.</p>
            )}
          </div>

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
        </GsapReveal>

        {mapSrc ? (
          <iframe
            title="Map"
            src={mapSrc}
            loading="lazy"
            className="h-full min-h-[24rem] w-full rounded-2xl border border-line"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="grid min-h-[24rem] place-items-center rounded-2xl border border-line bg-ink-900/40 text-sm text-fog-600">
            Location coming soon
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
      <div>
        <p className="text-xs text-fog-500">{label}</p>
        <p className="text-fog-100">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href} className="block transition hover:opacity-80">{content}</a> : content;
}

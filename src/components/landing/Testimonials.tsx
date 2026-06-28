import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const TESTIMONIALS = [
  {
    quote:
      "We replaced three different tools with RestoPanel. Setup took an afternoon and our online orders jumped within the first week.",
    name: "Amara Okafor",
    role: "Owner, Saffron & Co. — London",
  },
  {
    quote:
      "The dashboard is genuinely beautiful and our staff actually enjoy using it. Order status SMS cut our phone calls in half.",
    name: "Daniel Reyes",
    role: "GM, Verde Cantina — Toronto",
  },
  {
    quote:
      "As a small team this gave us an enterprise-grade ordering experience without the enterprise price tag.",
    name: "Megan Walsh",
    role: "Founder, Maple Diner — Chicago",
  },
  {
    quote:
      "Analytics finally make sense. I can see best sellers and peak hours at a glance and staff accordingly.",
    name: "Hassan Ali",
    role: "Owner, Harbour Grill — Manchester",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="relative px-4 py-24 sm:px-6">
      <SectionHeading
        eyebrow="Testimonials"
        title="Loved by restaurant owners"
        description="From independent kitchens to multi-location groups across the UK, US and Canada."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 md:grid-cols-2">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.name} index={i % 2}>
            <figure className="h-full rounded-2xl border border-line bg-ink-900/40 p-6 transition hover:border-violet-500/30">
              <div className="mb-3 text-gold-400">★★★★★</div>
              <blockquote className="text-pretty text-[15px] leading-relaxed text-fog-200">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-gold-400 text-sm font-bold text-ink-950">
                  {t.name.charAt(0)}
                </span>
                <span>
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="block text-xs text-fog-500">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

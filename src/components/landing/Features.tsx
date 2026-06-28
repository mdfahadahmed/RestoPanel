import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const FEATURES = [
  {
    icon: "🧾",
    title: "Menu & product management",
    desc: "Unlimited categories and products with images, variants, extras, prep time and live availability.",
  },
  {
    icon: "🛎️",
    title: "Real-time orders",
    desc: "Accept, prepare, ready and deliver. Every status change flows to your kitchen and the customer instantly.",
  },
  {
    icon: "📱",
    title: "Branded ordering site",
    desc: "Each restaurant gets its own customer-facing website to browse, search and order in a few taps.",
  },
  {
    icon: "💬",
    title: "SMS notifications",
    desc: "Customers get texts at every step — confirmed, preparing, ready, out for delivery and delivered.",
  },
  {
    icon: "📊",
    title: "Analytics & reports",
    desc: "Revenue, best sellers, peak hours and customer insights in beautiful, exportable dashboards.",
  },
  {
    icon: "🔐",
    title: "Secure multi-tenant",
    desc: "Every restaurant's data is fully isolated. Role-based access keeps owners and staff in their lane.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative px-4 py-24 sm:px-6">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to run service"
        description="One platform replaces your POS add-ons, ordering plugins and spreadsheets — purpose-built for restaurants."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} index={i % 3}>
            <div className="group h-full rounded-2xl border border-line bg-ink-900/40 p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-ink-900/70">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-850 text-xl transition group-hover:scale-110">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fog-400">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

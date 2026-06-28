import Link from "next/link";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const PLANS = [
  {
    name: "Starter",
    price: "£0",
    period: "/mo",
    tagline: "Launch and take your first orders.",
    features: [
      "1 restaurant workspace",
      "Branded ordering site",
      "Up to 50 products",
      "Order management",
      "Email support",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Growth",
    price: "£39",
    period: "/mo",
    tagline: "For busy restaurants scaling up.",
    features: [
      "Everything in Starter",
      "Unlimited products & categories",
      "SMS notifications",
      "Analytics & reports",
      "Coupons & discounts",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    featured: true,
  },
  {
    name: "Pro",
    price: "£89",
    period: "/mo",
    tagline: "Multi-location and full control.",
    features: [
      "Everything in Growth",
      "Staff management & roles",
      "Reviews & loyalty",
      "Custom domain",
      "API access",
      "Dedicated manager",
    ],
    cta: "Book a demo",
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative px-4 py-24 sm:px-6">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple plans that grow with you"
        description="Start free. Upgrade when you're ready. No per-order commissions, ever."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.name} index={i}>
            <div
              className={`relative flex h-full flex-col rounded-2xl border p-6 ${
                plan.featured
                  ? "border-violet-500/50 bg-ink-900/80 shadow-glow"
                  : "border-line bg-ink-900/40"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-violet-500 to-gold-400 px-3 py-1 text-[11px] font-semibold text-ink-950">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-fog-400">{plan.tagline}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                <span className="pb-1 text-sm text-fog-500">{plan.period}</span>
              </div>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-fog-300">
                    <span className="mt-0.5 text-violet-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`btn-glow mt-7 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-white text-ink-950 hover:bg-fog-100"
                    : "border border-line bg-ink-850 text-fog-100 hover:border-fog-500"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

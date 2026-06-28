import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { Counter } from "./Counter";

const REASONS = [
  {
    title: "Launch in minutes",
    desc: "Register and your dedicated dashboard plus customer site are generated automatically — no setup calls, no installs.",
  },
  {
    title: "Built for scale",
    desc: "Multi-tenant architecture and an API-first backend keep every restaurant fast and isolated as you grow.",
  },
  {
    title: "Designed to convert",
    desc: "A premium ordering experience that feels native on mobile and turns browsers into repeat customers.",
  },
  {
    title: "Owner-first pricing",
    desc: "Transparent plans with no per-order surprises. Keep more of every sale you make.",
  },
];

const STATS = [
  { node: <Counter to={32} suffix="%" />, label: "Higher repeat orders" },
  { node: <Counter to={3} suffix=" min" />, label: "Average go-live" },
  { node: <Counter to={24} suffix="/7" />, label: "Always-on ordering" },
  { node: <Counter to={0} prefix="£" />, label: "Setup fees" },
];

export function WhyChoose() {
  return (
    <section className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Why RestoPanel"
            title="The premium choice for serious operators"
            align="left"
          />
          <div className="mt-8 space-y-5">
            {REASONS.map((r, i) => (
              <Reveal key={r.title} index={i}>
                <div className="flex gap-4">
                  <div className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs text-violet-300">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-medium">{r.title}</h3>
                    <p className="mt-1 text-sm text-fog-400">{r.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal index={1}>
          <div className="grid grid-cols-2 gap-4">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="glass rounded-2xl p-6 text-center transition hover:-translate-y-1"
              >
                <div className="text-3xl font-semibold text-gradient-gold">{s.node}</div>
                <div className="mt-2 text-xs text-fog-400">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

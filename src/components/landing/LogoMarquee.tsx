const LOGOS = [
  "The Copper Spoon",
  "Saffron & Co.",
  "Nori House",
  "Bella Tavola",
  "Smoke & Barrel",
  "Verde Cantina",
  "Harbour Grill",
  "Maple Diner",
];

export function LogoMarquee() {
  return (
    <section className="border-y border-line/60 bg-ink-950/60 py-10">
      <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-fog-500">
        Powering restaurants of every size
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]">
        <div className="flex w-max animate-[marquee_32s_linear_infinite] gap-12 pr-12">
          {[...LOGOS, ...LOGOS].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-lg font-medium tracking-tight text-fog-500"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

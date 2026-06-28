import { Reveal } from "./Reveal";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: SectionHeadingProps) {
  return (
    <div
      className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : "text-left"}`}
    >
      <Reveal>
        <span className="inline-block rounded-full border border-line bg-ink-900/60 px-3 py-1 text-xs uppercase tracking-[0.16em] text-violet-300">
          {eyebrow}
        </span>
      </Reveal>
      <Reveal index={1}>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal index={2}>
          <p className="mt-4 text-pretty text-base text-fog-400">{description}</p>
        </Reveal>
      )}
    </div>
  );
}

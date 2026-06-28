"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Star } from "lucide-react";

interface HeroProps {
  slug: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
  rating: number;
  reviewCount: number;
}

export function Hero({ slug, name, description, coverImageUrl, logoUrl, rating, reviewCount }: HeroProps) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let ctx: { revert: () => void } | undefined;
    let cancelled = false;
    (async () => {
      const { gsap } = await import("gsap");
      if (cancelled || !root.current) return;
      ctx = gsap.context(() => {
        gsap.from("[data-hero]", {
          y: 28,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
          clearProps: "opacity,transform",
        });
      }, root);
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <section ref={root} className="relative overflow-hidden">
      <div className="absolute inset-0">
        {coverImageUrl ? (
          <Image src={coverImageUrl} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/80 to-ink-950/40" />
      </div>

      <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col items-start justify-center px-4 py-20 sm:px-6">
        {logoUrl && (
          <Image
            data-hero
            src={logoUrl}
            alt={name}
            width={80}
            height={80}
            className="mb-6 h-20 w-20 rounded-2xl object-cover ring-1 ring-line"
          />
        )}
        {reviewCount > 0 && (
          <div data-hero className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-900/60 px-3 py-1 text-sm text-gold-300 backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" />
            {rating.toFixed(1)} <span className="text-fog-500">· {reviewCount} reviews</span>
          </div>
        )}
        <h1 data-hero className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight text-fog-50 sm:text-6xl">
          {name}
        </h1>
        {description && (
          <p data-hero className="mt-4 max-w-xl text-pretty text-lg text-fog-300">
            {description}
          </p>
        )}
        <div data-hero className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/r/${slug}/menu`}
            className="inline-flex items-center gap-2 rounded-full bg-gold-400 px-6 py-3 font-medium text-ink-950 transition hover:bg-gold-300"
          >
            View menu <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/r/${slug}/reservation`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 px-6 py-3 font-medium text-fog-100 backdrop-blur transition hover:bg-ink-800"
          >
            <CalendarDays className="h-4 w-4" /> Book a table
          </Link>
        </div>
      </div>
    </section>
  );
}

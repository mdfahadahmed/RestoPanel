"use client";

import { useEffect, useRef } from "react";

interface GsapRevealProps {
  children: React.ReactNode;
  /** Stagger between direct children, in seconds. */
  stagger?: number;
  className?: string;
}

/**
 * Premium one-shot entrance for dashboard sections. Animates direct children
 * (opacity + slight rise) on mount via GSAP, loaded dynamically so it never
 * runs during SSR. Respects `prefers-reduced-motion`.
 */
export function GsapReveal({ children, stagger = 0.04, className }: GsapRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const { gsap } = await import("gsap");
      if (cancelled || !ref.current) return;
      ctx = gsap.context(() => {
        gsap.from(gsap.utils.toArray<HTMLElement>(ref.current!.children), {
          opacity: 0,
          y: 10,
          duration: 0.32,
          ease: "power2.out",
          stagger,
          clearProps: "opacity,transform",
        });
      }, ref);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [stagger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

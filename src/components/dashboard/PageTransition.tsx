"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Subtle GSAP fade/slide-in on each route change within the dashboard. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Honour users who prefer reduced motion — skip the animation entirely.
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let ctx: { revert: () => void } | undefined;
    (async () => {
      const { gsap } = await import("gsap");
      if (!ref.current) return;
      ctx = gsap.context(() => {
        gsap.fromTo(
          ref.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
        );
      }, ref);
    })();
    return () => ctx?.revert();
  }, [pathname]);

  return (
    <div ref={ref} className="will-change-transform">
      {children}
    </div>
  );
}

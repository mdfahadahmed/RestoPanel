import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Changelog — RestoPanel",
  description: "New features, improvements and fixes shipped to RestoPanel.",
};

type Tag = "New" | "Improved" | "Fixed" | "Security";

interface Entry {
  version: string;
  date: string;
  changes: { tag: Tag; text: string }[];
}

// Curated release notes. Newest first.
const RELEASES: Entry[] = [
  {
    version: "1.5.0",
    date: "July 2026",
    changes: [
      { tag: "New", text: "Customer accounts gain email verification, with a non-blocking prompt and rate-limited resend." },
      { tag: "New", text: "Recent login activity — see the device and IP for every sign-in, and sign out everywhere in one click." },
      { tag: "Security", text: "Rate limiting and origin (CSRF) checks added across all customer authentication endpoints." },
      { tag: "New", text: "Public blog and changelog, with FAQs now managed from the admin CMS." },
    ],
  },
  {
    version: "1.4.0",
    date: "July 2026",
    changes: [
      { tag: "New", text: "Password reset for customer accounts — single-use, time-limited email links." },
      { tag: "New", text: "Public order tracking: look up any order by number at /track-order." },
      { tag: "Improved", text: "Storefront and account now display prices in each restaurant's own currency (GBP / USD / CAD)." },
      { tag: "Fixed", text: "Coupon usage limits are enforced atomically, so a nearly-exhausted code can't be over-redeemed." },
    ],
  },
  {
    version: "1.3.0",
    date: "June 2026",
    changes: [
      { tag: "New", text: "Production-ready online payments for customer orders via Stripe (with a test-mode fallback)." },
      { tag: "New", text: "Full customer account panel: orders, tracking, favorites, saved addresses, profile and notifications." },
      { tag: "Improved", text: "Grouped, sectioned dashboard sidebars and a new inventory module." },
    ],
  },
  {
    version: "1.2.0",
    date: "June 2026",
    changes: [
      { tag: "New", text: "Two-factor authentication, passkeys, session management and an audit log for restaurant accounts." },
      { tag: "New", text: "Table reservations with a floor plan, availability windows and a booking form on the storefront." },
      { tag: "Improved", text: "Loyalty points, KDS and POS with cash-drawer sessions." },
    ],
  },
  {
    version: "1.1.0",
    date: "May 2026",
    changes: [
      { tag: "New", text: "Public REST API (v1) with scoped API keys, rate limiting and an OpenAPI spec." },
      { tag: "New", text: "Coupons, reviews, QR codes and SMS/email notifications." },
      { tag: "Improved", text: "Analytics dashboard: revenue, best sellers, category sales and new-vs-returning customers." },
    ],
  },
  {
    version: "1.0.0",
    date: "April 2026",
    changes: [
      { tag: "New", text: "RestoPanel launch — one-click onboarding into a dashboard and branded ordering site." },
      { tag: "New", text: "Menu management (categories, products, variants, extras) and the full order lifecycle." },
      { tag: "Security", text: "Hard multi-tenant isolation: every record scoped to its restaurant." },
    ],
  },
];

const TAG_STYLES: Record<Tag, string> = {
  New: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  Improved: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  Fixed: "bg-gold-400/15 text-gold-300 border-gold-400/25",
  Security: "bg-rose-500/15 text-rose-300 border-rose-500/25",
};

export default function ChangelogPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <header className="max-w-2xl">
          <span className="inline-block rounded-full border border-line bg-ink-900/60 px-3 py-1 text-xs uppercase tracking-[0.16em] text-violet-300">
            Changelog
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            What&apos;s new
          </h1>
          <p className="mt-3 text-pretty text-fog-400">
            Every meaningful update we ship to RestoPanel — features, improvements,
            fixes and security hardening.
          </p>
        </header>

        <div className="mt-14 space-y-12 border-l border-line pl-6 sm:pl-8">
          {RELEASES.map((release) => (
            <section key={release.version} className="relative">
              <span className="absolute -left-[1.65rem] top-1.5 grid h-3 w-3 place-items-center rounded-full bg-violet-500 ring-4 ring-ink-950 sm:-left-[2.15rem]" />
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-fog-50">
                  v{release.version}
                </h2>
                <span className="text-xs text-fog-500">{release.date}</span>
              </div>
              <ul className="mt-4 space-y-3">
                {release.changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TAG_STYLES[c.tag]}`}
                    >
                      {c.tag}
                    </span>
                    <span className="text-sm leading-relaxed text-fog-300">{c.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-14 text-center text-sm text-fog-500">
          Want a say in what we build next?{" "}
          <Link href="/#contact" className="font-medium text-violet-300 hover:text-violet-200">
            Send us feedback
          </Link>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}

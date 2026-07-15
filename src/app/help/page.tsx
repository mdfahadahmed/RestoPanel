import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Rocket,
  CreditCard,
  Code2,
  LifeBuoy,
  MessagesSquare,
  UtensilsCrossed,
  ShieldCheck,
} from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { getHelpFaqGroups } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Help Center — RestoPanel",
  description:
    "Guides, answers and support for running your restaurant on RestoPanel.",
};

const TOPICS = [
  { icon: Rocket, title: "Getting started", desc: "Register, set up your restaurant and take your first order.", href: "/register" },
  { icon: UtensilsCrossed, title: "Menu & products", desc: "Categories, products, variants, extras and availability.", href: "/#features" },
  { icon: CreditCard, title: "Billing & plans", desc: "Plans, the free trial, upgrades and invoices.", href: "/#pricing" },
  { icon: Code2, title: "Developer API", desc: "API keys, scopes and endpoints for integrations.", href: "/docs" },
  { icon: ShieldCheck, title: "Security", desc: "2FA, passkeys, sessions and login history.", href: "/#features" },
  { icon: BookOpen, title: "Changelog", desc: "See what's new in RestoPanel.", href: "/changelog" },
];

export default async function HelpCenterPage() {
  const groups = await getHelpFaqGroups();

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
        <header className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 px-3 py-1 text-xs uppercase tracking-[0.16em] text-violet-300">
            <LifeBuoy className="h-3.5 w-3.5" /> Help Center
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            How can we help?
          </h1>
          <p className="mt-3 text-pretty text-fog-400">
            Browse popular topics, find an answer below, or reach the team directly.
          </p>
        </header>

        {/* Topic cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((t) => (
            <Link
              key={t.title}
              href={t.href}
              className="group rounded-2xl border border-line bg-ink-900/40 p-5 transition hover:border-fog-700 hover:bg-ink-900/70"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-ink-850 text-violet-300">
                <t.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-semibold text-fog-100 transition group-hover:text-white">
                {t.title}
              </h2>
              <p className="mt-1 text-sm text-fog-500">{t.desc}</p>
            </Link>
          ))}
        </div>

        {/* FAQ by category */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-fog-50">
            Frequently asked questions
          </h2>
          <div className="mt-6 space-y-10">
            {groups.map((g) => (
              <div key={g.category}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-fog-500">
                  {g.category}
                </h3>
                <FaqAccordion faqs={g.items} />
              </div>
            ))}
          </div>
        </section>

        {/* Contact / support CTA */}
        <section className="mt-16 grid gap-4 rounded-3xl border border-line bg-gradient-to-br from-ink-900 to-ink-950 p-8 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-fog-50">
              Still need a hand?
            </h2>
            <p className="mt-2 text-sm text-fog-400">
              Signed-in owners can open a support ticket from the dashboard. Prefer
              email? We usually reply within a few hours.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Link
              href="/dashboard/support"
              className="btn-glow inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-fog-100"
            >
              <MessagesSquare className="h-4 w-4" /> Open a support ticket
            </Link>
            <Link
              href="/#contact"
              className="text-sm font-medium text-violet-300 hover:text-violet-200"
            >
              Or contact us →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

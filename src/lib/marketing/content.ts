import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { FaqEntry } from "@/components/landing/FaqAccordion";

/**
 * Public marketing content read from the admin-managed CMS. Wrapped in
 * `unstable_cache` so the landing page stays effectively static — the DB is only
 * hit every few minutes (or when the "marketing" tag is revalidated from the CMS
 * editor). Each getter falls back to curated defaults so the page is never empty
 * before an operator has added content.
 */

const REVALIDATE_SECONDS = 300;

/**
 * Run a CMS query, falling back to curated content when the database cannot be
 * reached. The public marketing pages (`/`, `/blog`, `/help`) are prerendered at
 * build time, so an unreachable DB used to abort the entire production build
 * ("Export encountered an error on /blog/page") rather than degrade. Mirrors the
 * `.catch(() => [])` guard already used in `app/sitemap.ts`.
 */
async function withFallback<T>(query: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await query();
  } catch (e) {
    console.warn(`[marketing] ${label} unavailable, serving fallback content:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

const DEFAULT_FAQS: FaqEntry[] = [
  {
    q: "How quickly can I get my restaurant online?",
    a: "Register with your details and RestoPanel instantly creates your dashboard, a unique restaurant ID and your customer ordering site. Most owners are taking test orders within minutes.",
  },
  {
    q: "Is my data separate from other restaurants?",
    a: "Yes. RestoPanel is multi-tenant by design — every record is scoped to your restaurant and no other account can ever access your menus, orders or customers.",
  },
  {
    q: "Do you charge commission on orders?",
    a: "Never. You pay a simple flat monthly plan and keep 100% of every order. No per-transaction fees.",
  },
  {
    q: "Can customers track their orders?",
    a: "Customers get updates at each stage and can follow a live status timeline with an estimated time — from confirmed to delivered.",
  },
  {
    q: "Which countries do you support?",
    a: "RestoPanel is optimised for restaurants in the UK, US and Canada, with per-restaurant currency, phone and SMS support tailored to each region.",
  },
  {
    q: "Can I manage staff and roles?",
    a: "Yes — invite staff with role-based access (Owner, Manager, Staff) so your team only sees what they need, and secure accounts with two-factor authentication.",
  },
];

/** Published FAQs for the landing section, newest curated defaults as fallback. */
export const getLandingFaqs = unstable_cache(
  async (): Promise<FaqEntry[]> => {
    const rows = await withFallback(
      () =>
        prisma.faqItem.findMany({
          where: { isPublished: true },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { question: true, answer: true },
        }),
      [],
      "landing FAQs"
    );
    if (rows.length === 0) return DEFAULT_FAQS;
    return rows.map((r) => ({ q: r.question, a: r.answer }));
  },
  ["landing-faqs"],
  { revalidate: REVALIDATE_SECONDS, tags: ["marketing"] }
);

export interface PublicPlan {
  slug: string;
  name: string;
  description: string | null;
  monthly: number;
  annualMonthly: number; // effective per-month price billed yearly
  annualTotal: number;
  currency: string;
  features: string[];
  featured: boolean;
  trialDays: number;
  isFree: boolean;
}

const DEFAULT_PLANS: PublicPlan[] = [
  {
    slug: "starter", name: "Starter", description: "Launch and take your first orders.",
    monthly: 0, annualMonthly: 0, annualTotal: 0, currency: "GBP", featured: false, trialDays: 0, isFree: true,
    features: ["1 restaurant workspace", "Branded ordering site", "Up to 50 products", "Order management", "Email support"],
  },
  {
    slug: "growth", name: "Growth", description: "For busy restaurants scaling up.",
    monthly: 39, annualMonthly: 31, annualTotal: 372, currency: "GBP", featured: true, trialDays: 14, isFree: false,
    features: ["Everything in Starter", "Unlimited products & categories", "SMS notifications", "Analytics & reports", "Coupons & discounts", "Priority support"],
  },
  {
    slug: "pro", name: "Pro", description: "Multi-location and full control.",
    monthly: 89, annualMonthly: 71, annualTotal: 852, currency: "GBP", featured: false, trialDays: 14, isFree: false,
    features: ["Everything in Growth", "Staff management & roles", "Reviews & loyalty", "Custom domain", "API access", "Dedicated manager"],
  },
];

/** Active plan catalogue for the marketing pricing section (falls back to curated). */
export const getPublicPlans = unstable_cache(
  async (): Promise<PublicPlan[]> => {
    const rows = await withFallback(
      () =>
        prisma.plan.findMany({
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: {
            slug: true, name: true, description: true, priceMonthly: true, priceYearly: true,
            currency: true, features: true, isFeatured: true, trialDays: true,
          },
        }),
      [],
      "public plans"
    );
    if (rows.length === 0) return DEFAULT_PLANS;
    return rows.map((p) => {
      const monthly = Number(p.priceMonthly);
      const annualTotal = Number(p.priceYearly);
      return {
        slug: p.slug,
        name: p.name,
        description: p.description,
        monthly,
        annualMonthly: Math.round(annualTotal / 12),
        annualTotal,
        currency: p.currency,
        features: p.features,
        featured: p.isFeatured,
        trialDays: p.trialDays,
        isFree: monthly === 0 && annualTotal === 0,
      };
    });
  },
  ["public-plans"],
  { revalidate: REVALIDATE_SECONDS, tags: ["marketing", "plans"] }
);

export interface FaqGroup {
  category: string;
  items: FaqEntry[];
}

/** Published FAQs grouped by category for the Help Center. */
export const getHelpFaqGroups = unstable_cache(
  async (): Promise<FaqGroup[]> => {
    const rows = await withFallback(
      () =>
        prisma.faqItem.findMany({
          where: { isPublished: true },
          orderBy: [{ category: "asc" }, { position: "asc" }, { createdAt: "asc" }],
          select: { category: true, question: true, answer: true },
        }),
      [],
      "help FAQs"
    );
    const source = rows.length > 0
      ? rows.map((r) => ({ category: r.category, q: r.question, a: r.answer }))
      : DEFAULT_FAQS.map((f) => ({ category: "General", ...f }));

    const byCategory = new Map<string, FaqEntry[]>();
    for (const r of source) {
      const list = byCategory.get(r.category) ?? [];
      list.push({ q: r.q, a: r.a });
      byCategory.set(r.category, list);
    }
    return [...byCategory.entries()].map(([category, items]) => ({ category, items }));
  },
  ["help-faq-groups"],
  { revalidate: REVALIDATE_SECONDS, tags: ["marketing"] }
);

/** Published blog posts (list view), newest first. */
export const getPublishedPosts = unstable_cache(
  async () => {
    return withFallback(
      () =>
        prisma.blogPost.findMany({
          where: { status: "PUBLISHED" },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          select: {
            slug: true,
            title: true,
            excerpt: true,
            coverUrl: true,
            author: true,
            publishedAt: true,
            createdAt: true,
          },
        }),
      [],
      "blog posts"
    );
  },
  ["published-posts"],
  { revalidate: REVALIDATE_SECONDS, tags: ["marketing"] }
);

/** A single published post by slug (or null). */
export const getPublishedPost = unstable_cache(
  async (slug: string) => {
    return withFallback(
      () =>
        prisma.blogPost.findFirst({
          where: { slug, status: "PUBLISHED" },
        }),
      null,
      `blog post "${slug}"`
    );
  },
  ["published-post"],
  { revalidate: REVALIDATE_SECONDS, tags: ["marketing"] }
);

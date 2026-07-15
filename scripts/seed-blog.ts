/**
 * Seed a few published starter blog posts so /blog launches with real content.
 * Idempotent: upserts by slug, so it's safe to run repeatedly. Operators can
 * then edit or add more from the admin CMS.
 *
 * Run: npm run db:seed:blog
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const POSTS = [
  {
    slug: "launch-your-restaurant-online-in-an-afternoon",
    title: "Launch your restaurant online in an afternoon",
    excerpt:
      "You don't need a developer or a six-week project. Here's how to go from sign-up to taking real orders on your own branded site the same day.",
    author: "RestoPanel",
    content: `Getting online used to mean hiring an agency, waiting weeks, and paying commissions on every order. It doesn't anymore.

When you register on RestoPanel, three things happen instantly: your admin dashboard, a unique web address for your restaurant, and a branded ordering site your customers can use right away.

Start with your menu. Create a few categories — Starters, Mains, Desserts — then add products with photos, prices and any variants or extras. Toggle a dish "Featured" or "Best seller" and it rises to the top of your storefront.

Next, set your rules in Settings: delivery, pickup or dine-in; your delivery fee and minimum order; tax and currency. Turn on cash on delivery, online card payments, or both.

That's it — your site is live. Share the link, print a QR code for tables, and watch orders land in your dashboard with a live status timeline your customers can follow. Most owners are taking test orders within minutes.`,
  },
  {
    slug: "stop-paying-commissions-own-your-ordering",
    title: "Stop paying commissions: own your ordering channel",
    excerpt:
      "Marketplace apps take a cut of every order and keep your customer data. Owning your ordering site flips both of those around.",
    author: "RestoPanel",
    content: `Third-party delivery apps are great for discovery — and expensive for everything else. A 20–30% commission on every order adds up fast, and the customer relationship belongs to the platform, not to you.

Owning your ordering channel changes the maths. With a flat monthly plan and no per-order fees, more of every sale stays with you. Just as importantly, the customer is yours: their order history, their contact details, their favourites.

That ownership compounds. You can run your own coupons and loyalty program, collect reviews tied to real delivered orders, and send order updates directly. You decide the delivery radius, the minimum order, and the payment methods.

Keep the marketplaces for reach if you like — but make your own site the place regulars come back to. It's the difference between renting customers and keeping them.`,
  },
  {
    slug: "turn-first-time-diners-into-regulars",
    title: "5 ways to turn first-time diners into regulars",
    excerpt:
      "The first order is the hard part. Turning it into a second, third and tenth is where the margin is — and most of it is automatable.",
    author: "RestoPanel",
    content: `Winning a new customer is expensive. Keeping one is cheap. Here are five things that quietly turn a one-off order into a habit.

1. Make reordering effortless. Saved favourites and one-tap reorder mean a repeat order takes seconds, not minutes.

2. Reward loyalty automatically. A simple points program gives people a reason to come back to you instead of the app next door.

3. Ask for a review at the right moment. Prompt for feedback once an order is delivered — happy customers leave ratings that win the next one.

4. Use coupons with intent. A first-order discount, a win-back offer for lapsed customers, a slow-Tuesday deal — each nudges behaviour without training people to only buy on sale.

5. Keep them informed. A live order timeline and clear updates build trust. People come back to experiences that feel reliable.

None of this requires a marketing team. Set it up once and let it run in the background while you cook.`,
  },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const post of POSTS) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug: post.slug },
      select: { id: true },
    });
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      create: { ...post, status: "PUBLISHED", publishedAt: new Date() },
      // Don't clobber publishedAt / edits on re-run; only ensure it's published.
      update: { title: post.title, excerpt: post.excerpt, content: post.content, status: "PUBLISHED" },
    });
    existing ? updated++ : created++;
    console.log(`  ${existing ? "↻" : "＋"} ${post.slug}`);
  }
  console.log(`\nStarter blog seeded — ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

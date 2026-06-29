/**
 * Bootstrap the Super Admin panel: create the default subscription plans and a
 * SUPER_ADMIN operator. Idempotent — safe to run repeatedly.
 *
 * Run: npx tsx scripts/seed-admin.ts
 * Optional env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PLANS = [
  {
    name: "Free", slug: "free", priceMonthly: 0, priceYearly: 0, trialDays: 0, position: 0, isFeatured: false,
    maxProducts: 20, maxOrders: 50, maxStaff: 1,
    analytics: false, smsNotifications: false, coupons: false, customDomain: false, prioritySupport: false,
    features: ["1 location", "Up to 20 products", "50 orders / month", "Online ordering"],
  },
  {
    name: "Starter", slug: "starter", priceMonthly: 19, priceYearly: 190, trialDays: 14, position: 1, isFeatured: true,
    maxProducts: 100, maxOrders: 500, maxStaff: 3,
    analytics: true, smsNotifications: false, coupons: true, customDomain: false, prioritySupport: false,
    features: ["Everything in Free", "Up to 100 products", "500 orders / month", "Analytics", "Coupons", "3 team members"],
  },
  {
    name: "Pro", slug: "pro", priceMonthly: 49, priceYearly: 490, trialDays: 14, position: 2, isFeatured: false,
    maxProducts: null, maxOrders: 5000, maxStaff: 10,
    analytics: true, smsNotifications: true, coupons: true, customDomain: true, prioritySupport: false,
    features: ["Everything in Starter", "Unlimited products", "SMS notifications", "Custom domain", "10 team members"],
  },
  {
    name: "Enterprise", slug: "enterprise", priceMonthly: 149, priceYearly: 1490, trialDays: 30, position: 3, isFeatured: false,
    maxProducts: null, maxOrders: null, maxStaff: null,
    analytics: true, smsNotifications: true, coupons: true, customDomain: true, prioritySupport: true,
    features: ["Everything in Pro", "Unlimited orders & staff", "Priority support", "Dedicated manager", "SLA"],
  },
];

async function main() {
  // Remove the legacy "Growth" plan from earlier seeds (only if unused).
  const growth = await prisma.plan.findUnique({ where: { slug: "growth" }, include: { _count: { select: { subscriptions: true } } } });
  if (growth && growth._count.subscriptions === 0) {
    await prisma.plan.delete({ where: { id: growth.id } });
    console.log("  ✓ removed legacy plan: Growth");
  }

  for (const p of PLANS) {
    const data = {
      name: p.name,
      priceMonthly: new Prisma.Decimal(p.priceMonthly),
      priceYearly: new Prisma.Decimal(p.priceYearly),
      trialDays: p.trialDays,
      position: p.position,
      isFeatured: p.isFeatured,
      features: p.features,
      maxProducts: p.maxProducts,
      maxOrders: p.maxOrders,
      maxStaff: p.maxStaff,
      analytics: p.analytics,
      smsNotifications: p.smsNotifications,
      coupons: p.coupons,
      customDomain: p.customDomain,
      prioritySupport: p.prioritySupport,
    };
    await prisma.plan.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...data },
      update: data,
    });
    console.log(`  ✓ plan: ${p.name}`);
  }

  // Singleton platform settings row.
  await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  console.log("  ✓ platform settings row");

  const email = (process.env.ADMIN_EMAIL ?? "admin@restopanel.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const name = process.env.ADMIN_NAME ?? "Platform Admin";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "SUPER_ADMIN" },
    update: { name },
  });
  console.log(`  ✓ super admin: ${email}`);
  console.log(`\nSign in at /admin/login  →  ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

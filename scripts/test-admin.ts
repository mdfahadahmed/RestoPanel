/**
 * End-to-end tests for the Super Admin module. Exercises the standalone admin
 * session (HMAC), platform metrics (MRR/ARR/revenue/churn), restaurant
 * moderation, subscriptions, support tickets, CMS and platform settings.
 *
 * Metric assertions use BEFORE/AFTER deltas so they are correct regardless of
 * existing data in the shared database. All test data is cleaned up at the end.
 *
 * Run: npx tsx scripts/test-admin.ts
 */
process.env.AUTH_SECRET ||= "test-secret-for-admin-suite";

import { PrismaClient, Prisma } from "@prisma/client";
import { signAdminToken, verifyAdminToken } from "../src/lib/admin/session";
import {
  getPlatformOverview,
  getPlatformSeries,
  getChurnBreakdown,
} from "../src/lib/admin/metrics";
import {
  listRestaurants,
  suspendRestaurant,
  activateRestaurant,
  softDeleteRestaurant,
  getRestaurantDetail,
} from "../src/lib/admin/restaurants";
import {
  upsertSubscription,
  setSubscriptionStatus,
} from "../src/lib/admin/subscriptions";
import {
  createTicket,
  replyToTicket,
  setTicketStatus,
  listTickets,
} from "../src/lib/admin/support";
import {
  upsertFaq,
  deleteFaq,
  upsertBlogPost,
  saveCmsPage,
  getCmsPage,
} from "../src/lib/admin/cms";
import {
  getPlatformSettings,
  savePlatformSettings,
} from "../src/lib/admin/settings";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}
const approx = (a: number, b: number, eps = 0.01) => Math.abs(a - b) < eps;

async function main() {
  const tag = `adm${Date.now().toString(36)}`;
  const D = (n: number) => new Prisma.Decimal(n);
  const now = new Date();
  const createdIds: string[] = [];
  let planId = "";
  let ticketId = "";
  let faqId = "";
  const cmsKey = `${tag}-page`;

  // Snapshot settings so we can restore the shared singleton afterwards.
  const settingsBefore = await getPlatformSettings();

  try {
    // ===================================================================== [1]
    console.log("\n[1] Admin session (HMAC sign/verify)");
    const token = await signAdminToken({ sub: "admin1", email: "a@b.com", role: "SUPER_ADMIN" });
    const decoded = await verifyAdminToken(token);
    check("valid token round-trips", decoded?.sub === "admin1" && decoded?.role === "SUPER_ADMIN", decoded);
    check("tampered token rejected", (await verifyAdminToken(token.slice(0, -2) + "xy")) === null);
    check("garbage token rejected", (await verifyAdminToken("not-a-token")) === null);
    check("empty token rejected", (await verifyAdminToken(undefined)) === null);
    const expired = await signAdminToken({ sub: "x", email: "x@y.z", role: "ADMIN" }, -10);
    check("expired token rejected", (await verifyAdminToken(expired)) === null);

    // ===================================================================== [2]
    console.log("\n[2] Seed platform data");
    const before = await getPlatformOverview(now);
    const churnBefore = await getChurnBreakdown(now);
    const seriesBefore = await getPlatformSeries(now);
    const lastRevBefore = seriesBefore.revenue[seriesBefore.revenue.length - 1].value;

    const plan = await prisma.plan.create({
      data: { name: `${tag} Plan`, slug: `${tag}-plan`, priceMonthly: D(30), priceYearly: D(300), trialDays: 14 },
    });
    planId = plan.id;

    async function makeRestaurant(suffix: string, status: "ACTIVE" | "SUSPENDED") {
      const r = await prisma.restaurant.create({
        data: {
          slug: `${tag}-${suffix}`,
          name: `${tag} ${suffix}`,
          ownerName: "Owner",
          email: `${suffix}@${tag}.test`,
          status,
          users: { create: { name: "Owner", email: `${suffix}-${tag}@owner.test`, passwordHash: "x", role: "OWNER" } },
        },
      });
      createdIds.push(r.id);
      return r;
    }

    const r1 = await makeRestaurant("r1", "ACTIVE");
    const r2 = await makeRestaurant("r2", "ACTIVE");
    const r3 = await makeRestaurant("r3", "SUSPENDED");
    const r4 = await makeRestaurant("r4", "ACTIVE");

    // Subscriptions (control amounts/cycle/status directly).
    const in5days = new Date(now.getTime() + 5 * 86_400_000);
    const in30days = new Date(now.getTime() + 30 * 86_400_000);
    await prisma.subscription.create({ data: { restaurantId: r1.id, planId, status: "ACTIVE", billingCycle: "MONTHLY", amount: D(30), currentPeriodEnd: in5days } });
    await prisma.subscription.create({ data: { restaurantId: r2.id, planId, status: "ACTIVE", billingCycle: "YEARLY", amount: D(300), currentPeriodEnd: in30days } });
    await prisma.subscription.create({ data: { restaurantId: r3.id, planId, status: "TRIALING", billingCycle: "MONTHLY", amount: D(30), currentPeriodEnd: in30days, trialEndsAt: in5days } });
    await prisma.subscription.create({ data: { restaurantId: r4.id, planId, status: "CANCELED", billingCycle: "MONTHLY", amount: D(30), currentPeriodEnd: in30days, canceledAt: now } });

    // Invoices.
    await prisma.invoice.create({ data: { restaurantId: r1.id, number: `${tag}-INV1`, amount: D(30), status: "PAID", paidAt: now } });
    await prisma.invoice.create({ data: { restaurantId: r2.id, number: `${tag}-INV2`, amount: D(300), status: "PAID", paidAt: now } });
    await prisma.invoice.create({ data: { restaurantId: r1.id, number: `${tag}-INV3`, amount: D(30), status: "OPEN" } });

    // ===================================================================== [3]
    console.log("\n[3] Platform overview metrics (deltas)");
    const after = await getPlatformOverview(now);
    check("totalRestaurants +4", after.totalRestaurants - before.totalRestaurants === 4, [before.totalRestaurants, after.totalRestaurants]);
    check("activeRestaurants +3", after.activeRestaurants - before.activeRestaurants === 3);
    check("suspendedRestaurants +1", after.suspendedRestaurants - before.suspendedRestaurants === 1);
    check("totalUsers +4", after.totalUsers - before.totalUsers === 4);
    check("activeSubscriptions +2", after.activeSubscriptions - before.activeSubscriptions === 2);
    check("trialUsers +1", after.trialUsers - before.trialUsers === 1);
    check("MRR +55 (30 + 300/12)", approx(after.mrr - before.mrr, 55), [before.mrr, after.mrr]);
    check("ARR +660", approx(after.arr - before.arr, 660), [before.arr, after.arr]);
    check("monthlyRevenue +330", approx(after.monthlyRevenue - before.monthlyRevenue, 330), [before.monthlyRevenue, after.monthlyRevenue]);
    check("totalRevenue +330 (OPEN invoice excluded)", approx(after.totalRevenue - before.totalRevenue, 330));
    check("newSignups +4", after.newSignups - before.newSignups === 4);
    check("expiringSubscriptions +>=1", after.expiringSubscriptions - before.expiringSubscriptions >= 1);

    console.log("\n[4] Churn + series");
    const churnAfter = await getChurnBreakdown(now);
    check("canceledLast30 +1", churnAfter.canceledLast30 - churnBefore.canceledLast30 === 1);
    check("newSubsLast30 +4", churnAfter.newSubsLast30 - churnBefore.newSubsLast30 === 4);
    const seriesAfter = await getPlatformSeries(now);
    check("revenue series has 12 buckets", seriesAfter.revenue.length === 12);
    check("growth series has 12 buckets", seriesAfter.restaurantGrowth.length === 12 && seriesAfter.userGrowth.length === 12);
    const lastRevAfter = seriesAfter.revenue[seriesAfter.revenue.length - 1].value;
    check("current month revenue bucket +330", approx(lastRevAfter - lastRevBefore, 330), [lastRevBefore, lastRevAfter]);

    // ===================================================================== [5]
    console.log("\n[5] Restaurant moderation");
    await suspendRestaurant(r1.id, "abuse");
    let detail = await getRestaurantDetail(r1.id);
    check("suspend sets SUSPENDED + reason", detail?.status === "SUSPENDED" && detail?.suspendedReason === "abuse" && !!detail?.suspendedAt);
    await activateRestaurant(r1.id);
    detail = await getRestaurantDetail(r1.id);
    check("activate restores ACTIVE + clears reason", detail?.status === "ACTIVE" && detail?.suspendedReason === null && detail?.suspendedAt === null);

    const listed = await listRestaurants({ search: tag, perPage: 50 });
    check("listRestaurants finds 4 by search", listed.rows.length === 4, listed.rows.length);
    const activeOnly = await listRestaurants({ search: tag, status: "ACTIVE", perPage: 50 });
    check("status filter ACTIVE returns 3", activeOnly.rows.length === 3, activeOnly.rows.length);

    await softDeleteRestaurant(r3.id);
    const afterDelete = await listRestaurants({ search: tag, perPage: 50 });
    check("soft-deleted restaurant excluded from listing", afterDelete.rows.length === 3 && !afterDelete.rows.some((x) => x.id === r3.id));
    check("getRestaurantDetail hides soft-deleted", (await getRestaurantDetail(r3.id)) === null);

    // ===================================================================== [6]
    console.log("\n[6] Subscriptions");
    const sub = await upsertSubscription({ restaurantId: r4.id, planId, status: "ACTIVE", billingCycle: "YEARLY", now });
    check("upsertSubscription snapshots yearly price (300)", approx(Number(sub.amount), 300), sub.amount);
    check("upsert replaces existing (one sub per restaurant)", sub.restaurantId === r4.id);
    const canceled = await setSubscriptionStatus(sub.id, "CANCELED", now);
    check("setSubscriptionStatus CANCELED sets canceledAt", canceled.status === "CANCELED" && !!canceled.canceledAt);

    // ===================================================================== [7]
    console.log("\n[7] Support tickets");
    const ticket = await createTicket({
      subject: `${tag} broken printer`,
      requesterName: "Jane",
      requesterEmail: `jane@${tag}.test`,
      body: "It will not print.",
      restaurantId: r1.id,
    });
    ticketId = ticket.id;
    check("createTicket OPEN with 1 owner message", ticket.status === "OPEN" && ticket.messages.length === 1 && ticket.messages[0].authorType === "OWNER");
    await replyToTicket(ticket.id, "Support Agent", "Try turning it off and on.", now);
    const replied = await prisma.supportTicket.findUnique({ where: { id: ticket.id }, include: { messages: true } });
    check("reply adds ADMIN message + moves to PENDING", replied?.status === "PENDING" && replied?.messages.length === 2 && replied.messages.some((m) => m.authorType === "ADMIN"));
    await setTicketStatus(ticket.id, "RESOLVED");
    const resolved = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
    check("setTicketStatus RESOLVED", resolved?.status === "RESOLVED");
    const foundTickets = await listTickets({ search: tag, perPage: 50 });
    check("listTickets finds ticket by search", foundTickets.rows.some((t) => t.id === ticket.id));

    // ===================================================================== [8]
    console.log("\n[8] CMS");
    const faq = await upsertFaq({ question: `${tag} Q1`, answer: "A1", category: "General", position: 0, isPublished: true });
    faqId = faq.id;
    check("FAQ created", !!faq.id && faq.question === `${tag} Q1`);
    const faqUpdated = await upsertFaq({ id: faq.id, question: `${tag} Q1`, answer: "A1 updated", category: "Billing", position: 1, isPublished: false });
    check("FAQ updates in place (same id)", faqUpdated.id === faq.id && faqUpdated.answer === "A1 updated" && faqUpdated.isPublished === false);

    const post = await upsertBlogPost({ slug: `${tag}-post`, title: "Hello", excerpt: null, content: "Body", coverUrl: null, author: "Admin", status: "PUBLISHED" });
    check("blog post PUBLISHED sets publishedAt", post.status === "PUBLISHED" && !!post.publishedAt);

    const page = await saveCmsPage(cmsKey, "Landing", { headline: "Welcome", subheadline: "Sub" });
    check("CMS page saved", page.key === cmsKey);
    const reread = await getCmsPage(cmsKey);
    check("CMS page content persisted as JSON", (reread?.content as { headline?: string })?.headline === "Welcome");
    const pageUpdate = await saveCmsPage(cmsKey, "Landing v2", { headline: "Updated" });
    check("CMS page upsert updates same key", pageUpdate.id === page.id && pageUpdate.title === "Landing v2");

    await deleteFaq(faq.id);
    faqId = "";
    check("deleteFaq removes row", (await prisma.faqItem.findUnique({ where: { id: faq.id } })) === null);

    // ===================================================================== [9]
    console.log("\n[9] Platform settings");
    await savePlatformSettings({
      platformName: "RestoPanel Test",
      supportEmail: "help@restopanel.test",
      logoUrl: "",
      faviconUrl: "",
      smtp: { host: "smtp.test", port: 587, user: "u", password: "p", fromEmail: "no-reply@test", enabled: true },
      cloudinary: { cloudName: "", apiKey: "", apiSecret: "", enabled: false },
      stripe: { publishableKey: "pk", secretKey: "sk", webhookSecret: "wh", enabled: true },
      sms: { provider: "twilio", accountSid: "sid", authToken: "tok", fromNumber: "+44", enabled: false },
      resend: { apiKey: "re_x", fromEmail: "no-reply@test", fromName: "Test", enabled: false },
      googleMaps: { apiKey: "gm", enabled: true },
    });
    const saved = await getPlatformSettings();
    check("settings scalar persisted", saved.platformName === "RestoPanel Test" && saved.supportEmail === "help@restopanel.test");
    check("settings smtp JSON persisted + enabled", (saved.smtp as { host?: string; enabled?: boolean }).host === "smtp.test" && (saved.smtp as { enabled?: boolean }).enabled === true);
    check("settings stripe enabled true", (saved.stripe as { enabled?: boolean }).enabled === true);
    check("settings cloudinary disabled", (saved.cloudinary as { enabled?: boolean }).enabled === false);
  } finally {
    // -------- cleanup (order matters for FKs) --------
    await prisma.supportTicket.deleteMany({ where: { subject: { startsWith: tag } } });
    if (ticketId) await prisma.supportTicket.deleteMany({ where: { id: ticketId } });
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } }); // cascades subs + invoices + users
    if (planId) await prisma.plan.deleteMany({ where: { id: planId } });
    if (faqId) await prisma.faqItem.deleteMany({ where: { id: faqId } });
    await prisma.faqItem.deleteMany({ where: { question: { startsWith: tag } } });
    await prisma.blogPost.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.cmsPage.deleteMany({ where: { key: cmsKey } });

    // Restore the shared platform settings singleton exactly as it was.
    await prisma.platformSettings.update({
      where: { id: "singleton" },
      data: {
        platformName: settingsBefore.platformName,
        supportEmail: settingsBefore.supportEmail,
        logoUrl: settingsBefore.logoUrl,
        faviconUrl: settingsBefore.faviconUrl,
        smtp: settingsBefore.smtp as object,
        cloudinary: settingsBefore.cloudinary as object,
        stripe: settingsBefore.stripe as object,
        sms: settingsBefore.sms as object,
        resend: settingsBefore.resend as object,
        googleMaps: settingsBefore.googleMaps as object,
      },
    });

    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

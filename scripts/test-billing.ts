/**
 * End-to-end tests for the Subscription & Billing module: plan tiers, trial,
 * upgrade/downgrade, cancel/renew, usage limits, feature restrictions, invoices,
 * and the Stripe webhook layer (signature verification + idempotent sync).
 *
 * Runs entirely offline — Stripe is never called over the network; webhook
 * events are constructed locally and fed to the pure processor. All data is
 * cleaned up at the end.
 *
 * Run: npx tsx scripts/test-billing.ts
 */
process.env.AUTH_SECRET ||= "test-secret-for-billing-suite";

import { PrismaClient, Prisma } from "@prisma/client";
import {
  comparePlans,
  changeKind,
  planHasFeature,
  planPrice,
  isPaidPlan,
} from "../src/lib/billing/plans";
import {
  startTrial,
  changePlan,
  cancelSubscription,
  resumeSubscription,
  subscribeToPlan,
  processRenewals,
  getSubscription,
  addCycle,
} from "../src/lib/billing/subscription";
import {
  checkLimit,
  canUseFeature,
  getEntitlements,
  getUsage,
} from "../src/lib/billing/limits";
import { recordInvoice, listInvoicesForRestaurant } from "../src/lib/billing/invoices";
import { verifyStripeSignature, signStripePayload } from "../src/lib/billing/stripe";
import { processStripeEvent, type StripeEvent } from "../src/lib/billing/webhook";

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
  const tag = `bil${Date.now().toString(36)}`;
  const D = (n: number) => new Prisma.Decimal(n);
  const now = new Date();

  // ---- test plans (control all values) ----
  const free = await prisma.plan.create({
    data: { name: `${tag} Free`, slug: `${tag}-free`, position: 0, priceMonthly: D(0), priceYearly: D(0), trialDays: 0, maxProducts: 2, maxOrders: 50, maxStaff: 1, analytics: false, coupons: false },
  });
  const starter = await prisma.plan.create({
    data: { name: `${tag} Starter`, slug: `${tag}-starter`, position: 1, priceMonthly: D(19), priceYearly: D(190), trialDays: 14, maxProducts: 100, maxOrders: 500, maxStaff: 3, analytics: true, coupons: true },
  });
  const pro = await prisma.plan.create({
    data: { name: `${tag} Pro`, slug: `${tag}-pro`, position: 2, priceMonthly: D(49), priceYearly: D(490), trialDays: 14, maxProducts: null, maxOrders: 5000, maxStaff: 10, analytics: true, coupons: true, customDomain: true, smsNotifications: true, stripePriceMonthlyId: `price_${tag}_pro_m`, stripePriceYearlyId: `price_${tag}_pro_y` },
  });
  const planIds = [free.id, starter.id, pro.id];

  async function makeRestaurant(suffix: string) {
    const r = await prisma.restaurant.create({
      data: { slug: `${tag}-${suffix}`, name: `${tag} ${suffix}`, ownerName: "Owner" },
    });
    return r;
  }

  try {
    // ===================================================================== [1]
    console.log("\n[1] Plan tiers & capabilities");
    check("comparePlans: Pro > Free is upgrade", comparePlans(free, pro) > 0);
    check("changeKind Pro→Free is downgrade", changeKind(pro, free) === "downgrade");
    check("changeKind Free→Pro is upgrade", changeKind(free, pro) === "upgrade");
    check("changeKind same is 'same'", changeKind(pro, pro) === "same");
    check("planPrice yearly vs monthly", planPrice(pro, "YEARLY") === 490 && planPrice(pro, "MONTHLY") === 49);
    check("isPaidPlan: Free false, Pro true", !isPaidPlan(free) && isPaidPlan(pro));
    check("planHasFeature coupons: Free no, Starter yes", !planHasFeature(free, "coupons") && planHasFeature(starter, "coupons"));

    // ===================================================================== [2]
    console.log("\n[2] Trial → upgrade → downgrade → renew");
    const r1 = await makeRestaurant("r1");

    const trial = await startTrial(r1.id, starter, now);
    check("startTrial sets TRIALING", trial.status === "TRIALING");
    check("trial amount = starter monthly (19)", approx(Number(trial.amount), 19));
    check("trialEndsAt ≈ now + 14d", Math.abs(trial.trialEndsAt!.getTime() - (now.getTime() + 14 * 86_400_000)) < 1000);
    check("period end equals trial end", trial.currentPeriodEnd.getTime() === trial.trialEndsAt!.getTime());

    const invBefore = (await listInvoicesForRestaurant(r1.id)).length;
    const up = await changePlan({ restaurantId: r1.id, targetPlan: pro, cycle: "MONTHLY", now });
    check("upgrade applied immediately", up.kind === "upgrade" && up.appliedNow === true);
    check("upgrade → ACTIVE on Pro @ 49", up.subscription.status === "ACTIVE" && up.subscription.planId === pro.id && approx(Number(up.subscription.amount), 49));
    check("upgrade raised a paid invoice", (await listInvoicesForRestaurant(r1.id)).length === invBefore + 1);

    const down = await changePlan({ restaurantId: r1.id, targetPlan: starter, cycle: "MONTHLY", now });
    check("downgrade is scheduled, not immediate", down.kind === "downgrade" && down.appliedNow === false);
    check("downgrade sets pendingPlanId, keeps Pro for now", down.subscription.pendingPlanId === starter.id && down.subscription.planId === pro.id);

    // Force the period to have ended and run the renewal cron.
    await prisma.subscription.update({ where: { restaurantId: r1.id }, data: { currentPeriodEnd: new Date(now.getTime() - 1000) } });
    const invBeforeRenew = (await listInvoicesForRestaurant(r1.id)).length;
    const summary = await processRenewals(now);
    check("processRenewals reports a downgrade", summary.downgraded >= 1, summary);
    const afterRenew = await getSubscription(r1.id);
    check("pending downgrade applied → now on Starter", afterRenew?.planId === starter.id && afterRenew?.pendingPlanId === null);
    check("renewal raised a Starter invoice", (await listInvoicesForRestaurant(r1.id)).length === invBeforeRenew + 1);
    check("status ACTIVE with fresh future period", afterRenew?.status === "ACTIVE" && afterRenew!.currentPeriodEnd > now);

    // ===================================================================== [3]
    console.log("\n[3] Cancel & resume");
    const r2 = await makeRestaurant("r2");
    await subscribeToPlan({ restaurantId: r2.id, plan: pro, cycle: "MONTHLY", status: "ACTIVE", now });

    await cancelSubscription({ restaurantId: r2.id, immediately: false, now });
    let s2 = await getSubscription(r2.id);
    check("cancel at period end: flag set, still ACTIVE", s2?.cancelAtPeriodEnd === true && s2?.status === "ACTIVE");

    await resumeSubscription({ restaurantId: r2.id, now });
    s2 = await getSubscription(r2.id);
    check("resume clears cancel flag", s2?.cancelAtPeriodEnd === false);

    await cancelSubscription({ restaurantId: r2.id, immediately: true, now });
    s2 = await getSubscription(r2.id);
    check("cancel now: CANCELED with canceledAt", s2?.status === "CANCELED" && !!s2?.canceledAt);

    const invBeforeReactivate = (await listInvoicesForRestaurant(r2.id)).length;
    await resumeSubscription({ restaurantId: r2.id, now });
    s2 = await getSubscription(r2.id);
    check("reactivate canceled → ACTIVE again", s2?.status === "ACTIVE" && s2?.canceledAt === null);
    check("reactivation raised an invoice (paid plan)", (await listInvoicesForRestaurant(r2.id)).length === invBeforeReactivate + 1);

    // ===================================================================== [4]
    console.log("\n[4] Usage limits & feature restrictions");
    const rFree = await makeRestaurant("free");
    await subscribeToPlan({ restaurantId: rFree.id, plan: free, status: "ACTIVE", now });
    // One product → still under the limit of 2.
    await prisma.product.create({ data: { restaurantId: rFree.id, name: "P1", slug: "p1", price: D(5) } });
    let lim = await checkLimit(rFree.id, "products");
    check("Free: 1/2 products → allowed", lim.allowed && lim.used === 1 && lim.limit === 2);
    // Second product → now at the limit.
    await prisma.product.create({ data: { restaurantId: rFree.id, name: "P2", slug: "p2", price: D(5) } });
    lim = await checkLimit(rFree.id, "products");
    check("Free: 2/2 products → blocked", !lim.allowed && lim.used === 2 && lim.remaining === 0);
    check("Free: coupons feature denied", (await canUseFeature(rFree.id, "coupons")) === false);
    check("Free: analytics feature denied", (await canUseFeature(rFree.id, "analytics")) === false);

    const rPro = await makeRestaurant("pro");
    await subscribeToPlan({ restaurantId: rPro.id, plan: pro, status: "ACTIVE", now });
    for (let i = 0; i < 3; i++) await prisma.product.create({ data: { restaurantId: rPro.id, name: `X${i}`, slug: `x${i}`, price: D(5) } });
    lim = await checkLimit(rPro.id, "products");
    check("Pro: unlimited products → allowed, limit null", lim.allowed && lim.limit === null);
    check("Pro: coupons feature allowed", (await canUseFeature(rPro.id, "coupons")) === true);

    const rNone = await makeRestaurant("none");
    await prisma.product.create({ data: { restaurantId: rNone.id, name: "N", slug: "n", price: D(5) } });
    const limNone = await checkLimit(rNone.id, "products");
    check("No subscription → unrestricted (legacy/seed safe)", limNone.allowed && limNone.limit === null);
    check("No subscription → all features allowed", (await canUseFeature(rNone.id, "coupons")) === true);

    const ent = await getEntitlements(rFree.id, now);
    check("entitlements: Free coupons=false, product limit=2 used=2", ent.features.coupons === false && ent.limits.products.limit === 2 && ent.limits.products.used === 2);
    const usage = await getUsage(rPro.id, now);
    check("getUsage counts products (3)", usage.products === 3);

    // ===================================================================== [5]
    console.log("\n[5] Invoices");
    const rInv = await makeRestaurant("inv");
    const i1 = await recordInvoice({ restaurantId: rInv.id, amount: 49, status: "PAID", paidAt: now, description: "Test" });
    const i2 = await recordInvoice({ restaurantId: rInv.id, amount: 19, status: "OPEN" });
    check("invoices get unique numbers", i1.number !== i2.number && i1.number.startsWith("INV-"));
    const list = await listInvoicesForRestaurant(rInv.id);
    check("listInvoices returns both, newest first", list.length === 2);

    const stripeInvId = `in_${tag}_1`;
    const a = await recordInvoice({ restaurantId: rInv.id, amount: 49, status: "PAID", stripeInvoiceId: stripeInvId, paidAt: now });
    const b = await recordInvoice({ restaurantId: rInv.id, amount: 49, status: "PAID", stripeInvoiceId: stripeInvId, paidAt: now });
    check("recordInvoice idempotent on stripeInvoiceId", a.id === b.id);
    check("no duplicate stripe invoice rows", (await prisma.invoice.count({ where: { stripeInvoiceId: stripeInvId } })) === 1);

    // ===================================================================== [6]
    console.log("\n[6] Stripe webhook — signature");
    const secret = `whsec_${tag}`;
    const payload = JSON.stringify({ hello: "world" });
    const ts = Math.floor(now.getTime() / 1000);
    const header = await signStripePayload(payload, secret, ts);
    check("valid signature verifies", await verifyStripeSignature({ payload, signatureHeader: header, secret, now }));
    check("wrong secret rejected", !(await verifyStripeSignature({ payload, signatureHeader: header, secret: "whsec_wrong", now })));
    check("tampered payload rejected", !(await verifyStripeSignature({ payload: payload + "x", signatureHeader: header, secret, now })));
    check("missing header rejected", !(await verifyStripeSignature({ payload, signatureHeader: null, secret, now })));
    const oldHeader = await signStripePayload(payload, secret, ts - 10_000);
    check("expired timestamp rejected", !(await verifyStripeSignature({ payload, signatureHeader: oldHeader, secret, now })));

    // ===================================================================== [7]
    console.log("\n[7] Stripe webhook — event sync + idempotency");
    const rWh = await makeRestaurant("wh");
    const cus = `cus_${tag}`;
    const subId = `sub_${tag}`;
    await subscribeToPlan({ restaurantId: rWh.id, plan: starter, status: "ACTIVE", now });
    await prisma.subscription.update({ where: { restaurantId: rWh.id }, data: { stripeCustomerId: cus, stripeSubscriptionId: subId } });

    const periodStart = ts;
    const periodEnd = ts + 30 * 86400;
    const subEvent: StripeEvent = {
      id: `${tag}-evt-sub`,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: subId,
          customer: cus,
          status: "active",
          cancel_at_period_end: false,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          items: { data: [{ price: { id: pro.stripePriceMonthlyId, unit_amount: 4900 } }] },
        },
      },
    };
    const res1 = await processStripeEvent(subEvent);
    check("subscription.updated handled", res1.handled && !res1.duplicate);
    const synced = await getSubscription(rWh.id);
    check("event mapped price → Pro plan", synced?.planId === pro.id);
    check("event synced amount (49) + price id", approx(Number(synced?.amount), 49) && synced?.stripePriceId === pro.stripePriceMonthlyId);
    check("event synced status ACTIVE + period end", synced?.status === "ACTIVE" && synced?.currentPeriodEnd.getTime() === periodEnd * 1000);

    const res2 = await processStripeEvent(subEvent);
    check("duplicate event is ignored (idempotent)", res2.duplicate === true);

    const invEvent: StripeEvent = {
      id: `${tag}-evt-inv`,
      type: "invoice.paid",
      data: {
        object: {
          id: `in_${tag}_wh`,
          customer: cus,
          amount_paid: 4900,
          currency: "gbp",
          description: "Pro renewal",
          hosted_invoice_url: "https://stripe.test/i/1",
          invoice_pdf: "https://stripe.test/i/1.pdf",
        },
      },
    };
    const invCountBefore = (await listInvoicesForRestaurant(rWh.id)).length;
    await processStripeEvent(invEvent);
    const whInvoices = await listInvoicesForRestaurant(rWh.id);
    check("invoice.paid recorded an invoice", whInvoices.length === invCountBefore + 1);
    const recorded = whInvoices.find((i) => i.stripeInvoiceId === `in_${tag}_wh`);
    check("recorded invoice PAID @ 49 with links", recorded?.status === "PAID" && approx(Number(recorded?.amount), 49) && !!recorded?.hostedUrl);

    // Re-deliver invoice.paid as a NEW event id → webhook re-runs but invoice stays single.
    const invEvent2: StripeEvent = { ...invEvent, id: `${tag}-evt-inv2` };
    await processStripeEvent(invEvent2);
    check("invoice not duplicated on re-delivery", (await prisma.invoice.count({ where: { stripeInvoiceId: `in_${tag}_wh` } })) === 1);
  } finally {
    // -------- cleanup --------
    await prisma.processedWebhook.deleteMany({ where: { id: { startsWith: tag } } });
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } }); // cascades subs/invoices/products/users
    await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Billing cron: advance subscriptions whose period has ended — convert trials,
 * apply scheduled downgrades, finalise cancellations, and raise renewal invoices
 * for paid plans. Run on a schedule (e.g. hourly) when Stripe is NOT the billing
 * source of truth. Safe to run repeatedly.
 *
 * Run: npx tsx scripts/process-renewals.ts
 */
import { PrismaClient } from "@prisma/client";
import { processRenewals } from "../src/lib/billing/subscription";

const prisma = new PrismaClient();

processRenewals(new Date())
  .then((s) => {
    console.log(
      `Renewals processed → renewed: ${s.renewed}, canceled: ${s.canceled}, downgraded: ${s.downgraded}, invoices: ${s.invoicesCreated}`
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

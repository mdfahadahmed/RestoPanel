/**
 * End-to-end test for the payment gateway (lib/payments) + checkout integration.
 *
 * Forces the deterministic mock online provider (PAYMENTS_MODE=mock) so the full
 * lifecycle — intent, success, failure/retry, refund, invoice, history, COD
 * mark-paid, tenant isolation and webhook signature verification — runs against
 * the live database without real Stripe keys. Cleans up everything it creates.
 *
 * Run: npx tsx scripts/test-payments.ts
 */
process.env.PAYMENTS_MODE = "mock";

import { Prisma, PrismaClient } from "@prisma/client";
import {
  startOrderPayment,
  settlePaymentByIntent,
  refundOrderPayment,
  markOrderPaid,
  generateOrderInvoice,
  listPayments,
  getOrderPayments,
  paymentSummary,
} from "../src/lib/payments/service";
import { placeOrderPublic } from "../src/app/r/[slug]/actions";
import { signStripePayload, verifyStripeSignature } from "../src/lib/billing/stripe";

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

async function createOrder(
  restaurantId: string,
  n: number,
  method: "CASH" | "CARD" | "ONLINE",
  total: number
) {
  return prisma.order.create({
    data: {
      restaurantId,
      orderNumber: String(n).padStart(4, "0"),
      type: "PICKUP",
      status: "CONFIRMED",
      customerName: "Test Payer",
      customerEmail: "payer@test.dev",
      paymentMethod: method,
      paymentStatus: "UNPAID",
      subtotal: new Prisma.Decimal(total),
      total: new Prisma.Decimal(total),
    },
    select: { id: true, orderNumber: true },
  });
}

async function main() {
  const tag = `__pay_${Date.now()}`;
  const r = await prisma.restaurant.create({
    data: { slug: `${tag}-r`, name: "Pay Bistro", ownerName: "O", currency: "GBP", onlinePaymentsEnabled: true, codEnabled: true },
  });
  const other = await prisma.restaurant.create({
    data: { slug: `${tag}-o`, name: "Other", ownerName: "O2" },
  });
  const product = await prisma.product.create({
    data: { restaurantId: r.id, name: "Meal", slug: "meal", status: "ACTIVE", isAvailable: true, price: new Prisma.Decimal(10), discount: new Prisma.Decimal(0) },
  });

  try {
    console.log("\n[1] Online payment — intent → success");
    const o1 = await createOrder(r.id, 1, "ONLINE", 25);
    const start = await startOrderPayment(o1.id);
    check("startOrderPayment ok", start.ok, start);
    if (!start.ok) throw new Error("startOrderPayment failed");
    const s1 = start.data!;
    check("provider is mock (no Stripe configured)", s1.provider === "mock");
    check("client secret returned", !!s1.clientSecret);
    check("requires client action", s1.online && s1.requiresAction);
    const pending = await prisma.payment.findFirst({ where: { orderId: o1.id, kind: "SALE" } });
    check("pending SALE payment recorded", pending?.status === "PENDING" && pending?.provider === "mock");

    // Idempotent: calling again resumes the same intent, no duplicate row.
    const again = await startOrderPayment(o1.id);
    check("startOrderPayment is idempotent (resumes intent)", again.ok && (again.ok ? again.data!.intentId : "") === s1.intentId);
    check("no duplicate payment rows", (await prisma.payment.count({ where: { orderId: o1.id, kind: "SALE" } })) === 1);

    const settle = await settlePaymentByIntent(s1.intentId, "succeeded", { cardLast4: "4242" });
    check("settle succeeded", settle.ok && settle.orderId === o1.id);
    const paidOrder = await prisma.order.findUnique({ where: { id: o1.id } });
    check("order marked PAID", paidOrder?.paymentStatus === "PAID");
    check("invoice generated on success", !!paidOrder?.invoiceNumber && !!paidOrder?.invoicedAt);
    const paidPayment = await prisma.payment.findFirst({ where: { orderId: o1.id, kind: "SALE" } });
    check("SALE payment SUCCEEDED + card captured", paidPayment?.status === "SUCCEEDED" && paidPayment?.cardLast4 === "4242");

    console.log("\n[2] Settlement idempotency");
    const dupe = await settlePaymentByIntent(s1.intentId, "succeeded");
    check("re-settling is a no-op", dupe.ok && dupe.already === true);
    check("still exactly one SALE row", (await prisma.payment.count({ where: { orderId: o1.id, kind: "SALE" } })) === 1);
    const invNo = paidOrder?.invoiceNumber;
    check("invoice number stable (idempotent)", (await generateOrderInvoice(o1.id)) === invNo);

    console.log("\n[3] Failed payment + retry");
    const o2 = await createOrder(r.id, 2, "ONLINE", 15);
    const failStart = await startOrderPayment(o2.id, { simulate: "fail" });
    check("failed intent recorded", failStart.ok && (failStart.ok ? failStart.data!.status : "") === "FAILED");
    const failRow = await prisma.payment.findFirst({ where: { orderId: o2.id, kind: "SALE" } });
    check("payment row is FAILED with reason", failRow?.status === "FAILED" && !!failRow?.failureReason);
    check("order stays UNPAID after failure", (await prisma.order.findUnique({ where: { id: o2.id } }))?.paymentStatus === "UNPAID");
    const failedList = await listPayments(r.id, { failedOnly: true });
    check("failed payment appears in failed list", failedList.some((p) => p.orderId === o2.id));
    // Retry succeeds.
    const retry = await startOrderPayment(o2.id);
    check("retry creates a fresh pending intent", retry.ok && (retry.ok ? retry.data!.status : "") === "PENDING");
    if (!retry.ok) throw new Error("retry failed");
    await settlePaymentByIntent(retry.data!.intentId, "succeeded");
    check("order PAID after successful retry", (await prisma.order.findUnique({ where: { id: o2.id } }))?.paymentStatus === "PAID");

    console.log("\n[4] Refund");
    const refund = await refundOrderPayment(r.id, o1.id, { reason: "Customer request" });
    check("refund ok", refund.ok, refund);
    check("full amount refunded (25)", refund.ok && (refund.ok ? refund.data!.refunded : 0) === 25);
    check("order marked REFUNDED", (await prisma.order.findUnique({ where: { id: o1.id } }))?.paymentStatus === "REFUNDED");
    const refundRow = await prisma.payment.findFirst({ where: { orderId: o1.id, kind: "REFUND" } });
    check("REFUND ledger row recorded", refundRow?.status === "SUCCEEDED" && Number(refundRow?.amount) === 25);
    const partial = await refundOrderPayment(r.id, o2.id, { amount: 5 });
    check("partial refund respects amount", partial.ok && (partial.ok ? partial.data!.refunded : 0) === 5);

    console.log("\n[5] Cash on delivery — mark paid");
    const o3 = await createOrder(r.id, 3, "CASH", 12);
    const codStart = await startOrderPayment(o3.id);
    check("COD start is offline (no client action)", codStart.ok && (codStart.ok ? !codStart.data!.online : false));
    check("COD order not yet paid", (await prisma.order.findUnique({ where: { id: o3.id } }))?.paymentStatus === "UNPAID");
    const marked = await markOrderPaid(r.id, o3.id);
    check("markOrderPaid ok", marked.ok);
    const codOrder = await prisma.order.findUnique({ where: { id: o3.id } });
    check("COD order PAID + invoiced", codOrder?.paymentStatus === "PAID" && !!codOrder?.invoiceNumber);
    check("markOrderPaid rejects an already-paid order", !(await markOrderPaid(r.id, o3.id)).ok);

    console.log("\n[6] Payment history + summary");
    const history = await getOrderPayments(r.id, o1.id);
    check("order history has sale + refund", history.length === 2);
    const summary = await paymentSummary(r.id);
    check("summary nets refunds against received", summary.netReceived === summary.grossReceived - summary.totalRefunded);
    check("summary counts failed payments", summary.failedCount >= 1);

    console.log("\n[7] Tenant isolation");
    const crossRefund = await refundOrderPayment(other.id, o1.id);
    check("cannot refund another tenant's order", !crossRefund.ok);
    const crossMark = await markOrderPaid(other.id, o3.id);
    check("cannot mark another tenant's order paid", !crossMark.ok);
    check("getOrderPayments is tenant-scoped", (await getOrderPayments(other.id, o1.id)).length === 0);

    console.log("\n[8] Checkout gating (placeOrderPublic)");
    const okOnline = await placeOrderPublic(`${tag}-r`, {
      customerName: "Web", customerPhone: "0700000001", type: "PICKUP", paymentMethod: "ONLINE",
      items: [{ productId: product.id, quantity: 1, extras: [] }],
    });
    check("online checkout allowed + flagged online", okOnline.ok && (okOnline.ok ? okOnline.data!.online === true && !!okOnline.data!.orderId : false));
    // Disable online payments → online checkout rejected.
    await prisma.restaurant.update({ where: { id: r.id }, data: { onlinePaymentsEnabled: false } });
    const noOnline = await placeOrderPublic(`${tag}-r`, {
      customerName: "Web", customerPhone: "0700000002", type: "PICKUP", paymentMethod: "CARD",
      items: [{ productId: product.id, quantity: 1, extras: [] }],
    });
    check("online rejected when disabled", !noOnline.ok);
    // Disable COD too → cash rejected.
    await prisma.restaurant.update({ where: { id: r.id }, data: { codEnabled: false } });
    const noCod = await placeOrderPublic(`${tag}-r`, {
      customerName: "Web", customerPhone: "0700000003", type: "PICKUP", paymentMethod: "CASH",
      items: [{ productId: product.id, quantity: 1, extras: [] }],
    });
    check("cash rejected when COD disabled", !noCod.ok);

    console.log("\n[9] Webhook signature verification");
    const payload = JSON.stringify({ id: "evt_test", type: "payment_intent.succeeded" });
    const secret = "whsec_test_secret";
    const ts = Math.floor(Date.now() / 1000);
    const header = await signStripePayload(payload, secret, ts);
    check("valid signature verifies", await verifyStripeSignature({ payload, signatureHeader: header, secret }));
    check("tampered payload rejected", !(await verifyStripeSignature({ payload: payload + "x", signatureHeader: header, secret })));
    check("wrong secret rejected", !(await verifyStripeSignature({ payload, signatureHeader: header, secret: "whsec_wrong" })));
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { in: [`${tag}-r`, `${tag}-o`] } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

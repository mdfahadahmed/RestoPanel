/**
 * End-to-end tests for the Notification Center: template rendering & overrides,
 * the Resend/Twilio provider payloads + send wrappers (with an injected fetch,
 * no network), the dispatch+logging engine (SKIPPED when providers are off),
 * and the high-level order/reservation/welcome helpers.
 *
 * Run: npx tsx scripts/test-notifications.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import {
  renderTemplate,
  renderResolved,
  getDefaultTemplate,
  EVENT_META,
  NOTIFICATION_EVENTS,
} from "../src/lib/notifications/templates";
import { resolveTemplate } from "../src/lib/notifications/resolve";
import {
  formatFrom,
  buildResendPayload,
  sendViaResend,
} from "../src/lib/notifications/providers/resend";
import {
  buildTwilioForm,
  twilioEndpoint,
  sendViaTwilio,
} from "../src/lib/notifications/providers/twilio";
import { dispatchNotification } from "../src/lib/notifications/dispatch";
import {
  notifyOrderStatus,
  notifyReservation,
  sendWelcomeEmail,
  ORDER_STATUS_EVENT,
} from "../src/lib/notifications/notify";
import {
  saveTemplateOverride,
  setTemplateActive,
  resetTemplate,
  listResolvedTemplates,
  listNotificationLogs,
  getNotificationStats,
} from "../src/lib/notifications/data";

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

// Fake fetch implementations (no network).
const fakeFetch = (status: number, body: unknown): typeof fetch =>
  (async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })) as unknown as typeof fetch;

async function main() {
  const tag = `ntf${Date.now().toString(36)}`;
  const D = (n: number) => new Prisma.Decimal(n);

  try {
    // ===================================================================== [1]
    console.log("\n[1] Template rendering");
    check("interpolates placeholders", renderTemplate("Hi {{name}}, order {{n}}", { name: "Al", n: "X1" }) === "Hi Al, order X1");
    check("unknown tokens → empty", renderTemplate("{{missing}}!", {}) === "!");
    check("whitespace-tolerant", renderTemplate("{{ name }}", { name: "Al" }) === "Al");
    check("coerces numbers", renderTemplate("{{p}}", { p: 2 }) === "2");

    const def = getDefaultTemplate("ORDER_CONFIRMED", "EMAIL");
    check("ORDER_CONFIRMED email default has subject + body", !!def?.subject && def!.body.includes("{{orderNumber}}"));
    check("WELCOME has no SMS template", getDefaultTemplate("WELCOME", "SMS") === undefined);
    check("WELCOME is email-only", JSON.stringify(EVENT_META.WELCOME.channels) === JSON.stringify(["EMAIL"]));
    const rr = renderResolved({ subject: "Order {{orderNumber}}", body: "Hi {{customerName}}" }, { orderNumber: "A9", customerName: "Sam" });
    check("renderResolved fills subject + body", rr.subject === "Order A9" && rr.body === "Hi Sam");

    // ===================================================================== [2]
    console.log("\n[2] Provider payload builders");
    const emailCfg = { apiKey: "re_x", fromEmail: "from@test.com", fromName: "Platform" };
    check("formatFrom uses platform name by default", formatFrom(emailCfg) === "Platform <from@test.com>");
    check("formatFrom prefers sender name", formatFrom(emailCfg, "Bella Pizza") === "Bella Pizza <from@test.com>");
    const payload = buildResendPayload(emailCfg, { to: "a@b.com", subject: "S", text: "T", senderName: "Bella" });
    check("buildResendPayload shape", payload.from === "Bella <from@test.com>" && payload.to[0] === "a@b.com" && payload.subject === "S" && payload.text === "T");

    const smsCfg = { accountSid: "AC123", authToken: "tok", fromNumber: "+1999" };
    const form = buildTwilioForm(smsCfg, { to: "+4477", body: "hi there" });
    check("buildTwilioForm encodes From/To/Body", form.includes("From=%2B1999") && form.includes("To=%2B4477") && form.includes("Body=hi+there"), form);
    check("twilioEndpoint embeds account sid", twilioEndpoint("AC123").includes("/Accounts/AC123/Messages.json"));

    // ===================================================================== [3]
    console.log("\n[3] Provider send wrappers (injected fetch)");
    const okEmail = await sendViaResend(emailCfg, { to: "a@b.com", subject: "S", text: "T" }, fakeFetch(200, { id: "em_1" }));
    check("resend success returns id", okEmail.ok && okEmail.id === "em_1");
    const errEmail = await sendViaResend(emailCfg, { to: "a@b.com", subject: "S", text: "T" }, fakeFetch(401, { message: "bad key" }));
    check("resend failure surfaces error", !errEmail.ok && errEmail.error === "bad key");
    const okSms = await sendViaTwilio(smsCfg, { to: "+44", body: "hi" }, fakeFetch(201, { sid: "SM1" }));
    check("twilio success returns sid", okSms.ok && okSms.id === "SM1");
    const errSms = await sendViaTwilio(smsCfg, { to: "+44", body: "hi" }, fakeFetch(400, { message: "invalid number" }));
    check("twilio failure surfaces error", !errSms.ok && errSms.error === "invalid number");

    // ===================================================================== [4]
    console.log("\n[4] Template resolution + overrides (DB)");
    const a = await prisma.restaurant.create({ data: { slug: `${tag}-a`, name: "Bella", ownerName: "Sam", currencySymbol: "£" } });
    const b = await prisma.restaurant.create({ data: { slug: `${tag}-b`, name: "Other", ownerName: "B" } });

    let resolved = await resolveTemplate(a.id, "ORDER_CONFIRMED", "EMAIL");
    check("resolves to default first", resolved !== null && resolved.isCustom === false && resolved.isActive === true);

    await saveTemplateOverride({ restaurantId: a.id, event: "ORDER_CONFIRMED", channel: "EMAIL", subject: "Custom {{orderNumber}}", body: "Custom body {{customerName}}" });
    resolved = await resolveTemplate(a.id, "ORDER_CONFIRMED", "EMAIL");
    check("override is used when present", resolved?.isCustom === true && resolved?.body === "Custom body {{customerName}}");

    await setTemplateActive({ restaurantId: a.id, event: "ORDER_CONFIRMED", channel: "SMS", isActive: false });
    resolved = await resolveTemplate(a.id, "ORDER_CONFIRMED", "SMS");
    check("disabled channel → isActive false", resolved?.isActive === false);

    await resetTemplate(a.id, "ORDER_CONFIRMED", "EMAIL");
    resolved = await resolveTemplate(a.id, "ORDER_CONFIRMED", "EMAIL");
    check("reset reverts to default", resolved?.isCustom === false);

    const allTemplates = await listResolvedTemplates(a.id);
    // 4 order events ×2 + RESERVATION ×2 + 3 reservation-lifecycle ×2 + WELCOME ×1 = 17
    check("listResolvedTemplates covers all event×channel (17)", allTemplates.length === 17, allTemplates.length);

    // ===================================================================== [5]
    console.log("\n[5] Dispatch + logging (providers off → SKIPPED)");
    const d1 = await dispatchNotification({
      restaurantId: a.id,
      event: "ORDER_CONFIRMED",
      channel: "EMAIL",
      recipient: "guest@test.com",
      context: { customerName: "Sam", restaurantName: "Bella", orderNumber: "A-1", total: "£10.00", trackUrl: "u" },
    });
    check("email dispatch logs SKIPPED (no provider)", d1.status === "SKIPPED" && d1.provider === "resend");
    const log1 = await prisma.notificationLog.findUnique({ where: { id: d1.logId } });
    check("log stores rendered body", !!log1 && log1.body.includes("A-1") && log1.recipient === "guest@test.com");

    const d2 = await dispatchNotification({ restaurantId: a.id, event: "ORDER_CONFIRMED", channel: "EMAIL", recipient: "", context: {} });
    check("no recipient → SKIPPED", d2.status === "SKIPPED");
    const log2 = await prisma.notificationLog.findUnique({ where: { id: d2.logId } });
    check("no-recipient reason recorded", log2?.error === "No recipient");

    // SMS channel disabled earlier for ORDER_CONFIRMED on restaurant A.
    const d3 = await dispatchNotification({ restaurantId: a.id, event: "ORDER_CONFIRMED", channel: "SMS", recipient: "+44", context: {} });
    check("disabled channel → SKIPPED", d3.status === "SKIPPED");
    check("disabled reason recorded", (await prisma.notificationLog.findUnique({ where: { id: d3.logId } }))?.error === "Channel disabled");

    // ===================================================================== [6]
    console.log("\n[6] High-level helpers");
    check("ORDER_STATUS_EVENT maps the 4 events", ORDER_STATUS_EVENT.CONFIRMED === "ORDER_CONFIRMED" && ORDER_STATUS_EVENT.DELIVERED === "ORDER_DELIVERED");
    check("non-notifying status maps to nothing", ORDER_STATUS_EVENT.PENDING === undefined);

    const order = await prisma.order.create({
      data: {
        restaurantId: a.id, orderNumber: `${tag}-100`, status: "CONFIRMED", paymentMethod: "CASH",
        customerName: "Sam", customerPhone: "+4470", customerEmail: "sam@test.com",
        subtotal: D(10), total: D(12),
      },
    });
    const orderResults = await notifyOrderStatus(order.id, "CONFIRMED");
    // EMAIL active (reset to default), SMS disabled → both produce a log row.
    check("order notify dispatches both channels", orderResults.length === 2, orderResults.map((r) => r.status));
    const orderLog = await prisma.notificationLog.findFirst({ where: { restaurantId: a.id, event: "ORDER_CONFIRMED", channel: "EMAIL", recipient: "sam@test.com" }, orderBy: { createdAt: "desc" } });
    check("order email body has number + £ total", !!orderLog && orderLog.body.includes(`${tag}-100`) && orderLog.body.includes("£12.00"), orderLog?.body);
    check("non-notifying status → no dispatch", (await notifyOrderStatus(order.id, "PENDING")).length === 0);

    const reservation = await prisma.reservation.create({
      data: { restaurantId: a.id, name: "Dana", phone: "+4471", email: "dana@test.com", date: new Date(Date.now() + 86_400_000), partySize: 4, status: "PENDING" },
    });
    const resResults = await notifyReservation(reservation.id);
    check("reservation notify uses email + sms", resResults.length === 2);
    const resLog = await prisma.notificationLog.findFirst({ where: { restaurantId: a.id, event: "RESERVATION", channel: "EMAIL" }, orderBy: { createdAt: "desc" } });
    check("reservation body has party size", !!resLog && resLog.body.includes("4"));

    const welcome = await sendWelcomeEmail(a.id, "owner@test.com", "Sam");
    check("welcome sends one email", welcome.length === 1 && welcome[0].provider === "resend");
    const welcomeLog = await prisma.notificationLog.findFirst({ where: { restaurantId: a.id, event: "WELCOME" }, orderBy: { createdAt: "desc" } });
    check("welcome body has restaurant name + dashboard", !!welcomeLog && welcomeLog.body.includes("Bella") && welcomeLog.body.includes("/dashboard"));

    // ===================================================================== [7]
    console.log("\n[7] Logs + stats + tenant scoping");
    const logs = await listNotificationLogs(a.id, { perPage: 100 });
    check("logs are tenant-scoped to A", logs.rows.every((l) => l.restaurantId === a.id) && logs.total >= 6);
    const stats = await getNotificationStats(a.id);
    check("stats total matches logs", stats.total === logs.total && stats.SKIPPED >= 1);
    const bLogs = await listNotificationLogs(b.id, { perPage: 100 });
    check("restaurant B has no logs", bLogs.total === 0);
    const channelFiltered = await listNotificationLogs(a.id, { channel: "SMS", perPage: 100 });
    check("channel filter works", channelFiltered.rows.every((l) => l.channel === "SMS"));
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { startsWith: tag } } }); // cascades logs/templates/orders/reservations
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

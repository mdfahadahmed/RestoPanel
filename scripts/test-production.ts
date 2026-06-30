/**
 * Data + unit test for the production-readiness features: structured logging
 * (+ secret redaction), provider-agnostic error monitoring, the health probe
 * (live DB round-trip), custom-domain resolution (+ tenant isolation), the cron
 * secret guard, and the backup filename helper.
 *
 * Run: npx tsx scripts/test-production.ts
 */
import { PrismaClient } from "@prisma/client";
import { buildRecord, redact, shouldLog } from "../src/lib/log";
import { toErrorEvent, isMonitoringConfigured, captureError } from "../src/lib/monitoring";
import { checkDatabase, checkHealth } from "../src/lib/health";
import {
  normalizeHost,
  isValidDomain,
  hostCandidates,
  isPlatformHost,
  resolveRestaurantByHost,
} from "../src/lib/domains";
import { verifyCronRequest, cronSecretFromHeaders } from "../src/lib/cron";
import { backupFilename } from "./backup-db";

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

async function main() {
  const tag = `prodtest${Date.now().toString(36)}`;

  try {
    console.log("\n[1] Structured logging + redaction");
    const rec = buildRecord("info", "hello", { userId: "u1", token: "abc" });
    check("record has level/message/time", rec.level === "info" && rec.message === "hello" && typeof rec.time === "string");
    check("record redacts secrets in context", rec.token === "[redacted]" && rec.userId === "u1");
    const r = redact({ password: "p", nested: { authorization: "Bearer x", ok: 1 }, list: [{ apiKey: "k" }] }) as Record<string, unknown>;
    check("redact top-level secret", r.password === "[redacted]");
    check("redact nested secret + keeps safe", (r.nested as Record<string, unknown>).authorization === "[redacted]" && (r.nested as Record<string, unknown>).ok === 1);
    check("redact inside arrays", ((r.list as Record<string, unknown>[])[0]).apiKey === "[redacted]");
    check("level filtering", shouldLog("error", "info") && !shouldLog("debug", "info") && shouldLog("warn", "warn"));

    console.log("\n[2] Error monitoring");
    delete process.env.SENTRY_DSN;
    delete process.env.ERROR_WEBHOOK_URL;
    check("not configured without env", isMonitoringConfigured() === false);
    const ev = toErrorEvent(new Error("boom"), { token: "secret", userId: "u" });
    check("event from Error", ev.message === "boom" && ev.name === "Error" && ev.level === "error");
    check("event context redacted", ev.context?.token === "[redacted]" && ev.context?.userId === "u");
    check("event from string", toErrorEvent("oops").message === "oops");

    process.env.ERROR_WEBHOOK_URL = "https://hook.test/err";
    check("configured with webhook", isMonitoringConfigured() === true);
    let webhookCalled: string | null = null;
    const stubFetch = ((url: unknown) => {
      webhookCalled = String(url);
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as unknown as typeof fetch;
    const captured = await captureError(new Error("kaboom"), { password: "x", n: 2 }, stubFetch);
    check("captureError returns the event", captured.message === "kaboom");
    check("captureError redacts + ships to webhook", captured.context?.password === "[redacted]" && webhookCalled === "https://hook.test/err");
    delete process.env.ERROR_WEBHOOK_URL;

    console.log("\n[3] Health probe");
    const db = await checkDatabase();
    check("database check round-trips", db.ok === true && db.latencyMs >= 0, db);
    const health = await checkHealth();
    check("health ok with db up", health.status === "ok" && health.checks.database.ok === true);
    check("health reports version + uptime", typeof health.version === "string" && health.uptimeSeconds >= 0);

    console.log("\n[4] Custom-domain helpers");
    check("normalizeHost strips scheme/port/path/case", normalizeHost("HTTPS://Www.Example.COM:443/menu") === "www.example.com");
    check("valid public domain", isValidDomain("shop.example.co.uk"));
    check("rejects localhost", !isValidDomain("localhost"));
    check("rejects IPv4", !isValidDomain("203.0.113.5"));
    check("rejects bare label", !isValidDomain("foo"));
    check("rejects vercel.app subdomain", !isValidDomain("x.vercel.app"));
    check("candidates include www + bare", hostCandidates("www.shop.com").includes("shop.com") && hostCandidates("shop.com").includes("www.shop.com"));
    check("platform host match (exact + subdomain)", isPlatformHost("app.foo.com", ["app.foo.com"]) && isPlatformHost("x.foo.com", ["foo.com"]) && !isPlatformHost("other.com", ["foo.com"]));

    console.log("\n[5] Custom-domain resolution + isolation");
    const verified = await prisma.restaurant.create({
      data: { slug: `${tag}-a`, name: "A", ownerName: "A", customDomain: `menu-${tag}.example.com`, customDomainVerifiedAt: new Date() },
    });
    const unverified = await prisma.restaurant.create({
      data: { slug: `${tag}-b`, name: "B", ownerName: "B", customDomain: `shop-${tag}.example.com` },
    });
    const appHosts = ["app.restopanel.test"];
    check("resolves verified custom domain", (await resolveRestaurantByHost(`menu-${tag}.example.com`, appHosts))?.id === verified.id);
    check("resolves via www candidate", (await resolveRestaurantByHost(`www.menu-${tag}.example.com`, appHosts))?.id === verified.id);
    check("unverified domain does not resolve", (await resolveRestaurantByHost(`shop-${tag}.example.com`, appHosts)) === null);
    check("platform host does not resolve", (await resolveRestaurantByHost("app.restopanel.test", appHosts)) === null);
    check("unknown host does not resolve", (await resolveRestaurantByHost(`nope-${tag}.example.com`, appHosts)) === null);
    void unverified;

    console.log("\n[6] Cron secret guard");
    const secret = "topsecret";
    const withAuth = new Headers({ authorization: `Bearer ${secret}` });
    const withHeader = new Headers({ "x-cron-secret": secret });
    check("parses bearer secret", cronSecretFromHeaders(withAuth) === secret);
    check("valid bearer allowed", verifyCronRequest(withAuth, secret).allowed === true);
    check("valid x-cron-secret allowed", verifyCronRequest(withHeader, secret).allowed === true);
    check("wrong secret rejected", verifyCronRequest(new Headers({ authorization: "Bearer nope" }), secret).allowed === false);
    check("missing secret rejected", verifyCronRequest(new Headers(), secret).allowed === false);

    console.log("\n[7] Backup filename");
    const name = backupFilename(new Date("2026-07-01T10:20:30.500Z"));
    check("timestamped gzip sql name", name === "restopanel-2026-07-01T10-20-30-500Z.sql.gz", name);
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { in: [`${tag}-a`, `${tag}-b`] } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

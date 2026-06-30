/**
 * End-to-end data test for the Mobile App backend.
 *
 * Exercises the mobile access-token signing/verification, staff login + refresh
 * rotation + logout/revocation, request authentication + the mobile gateway
 * (over real Requests, incl. RBAC), push-token registration + provider-agnostic
 * dispatch, and offline delta-sync with cursors + tombstones — including
 * cross-tenant isolation.
 *
 * Run: npx tsx scripts/test-mobile.ts
 */
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-mobile-secret";

import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signMobileToken, verifyMobileToken } from "../src/lib/mobile/token";
import {
  loginMobile,
  refreshMobile,
  logoutMobile,
  authenticateMobile,
} from "../src/lib/mobile/auth";
import { registerPushToken, unregisterPushToken, listDevices } from "../src/lib/mobile/devices";
import { resolvePushTokens, sendPushToUser } from "../src/lib/mobile/push";
import { buildExpoMessages, isPushConfigured } from "../src/lib/notifications/providers/push";
import { getSyncDelta } from "../src/lib/mobile/sync";
import { handleMobileApi } from "../src/lib/mobile/gateway";
import { ok } from "../src/lib/api/respond";

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

function bearer(token: string): Request {
  return new Request("https://x/api/v1/mobile/me", { headers: { Authorization: `Bearer ${token}` } });
}

async function main() {
  const tag = `__mobtest_${Date.now()}`;
  const pw = await bcrypt.hash("password123", 10);
  const tenantA = await prisma.restaurant.create({
    data: {
      slug: `${tag}-a`,
      name: "MA",
      ownerName: "A",
      users: {
        create: [
          { name: "Mia Manager", email: `mgr@${tag}.test`, passwordHash: pw, role: "MANAGER" },
          { name: "Ina Inactive", email: `off@${tag}.test`, passwordHash: pw, role: "WAITER", isActive: false },
        ],
      },
    },
    include: { users: true },
  });
  const tenantB = await prisma.restaurant.create({
    data: {
      slug: `${tag}-b`,
      name: "MB",
      ownerName: "B",
      users: { create: { name: "Bob B", email: `bob@${tag}.test`, passwordHash: pw, role: "MANAGER" } },
    },
    include: { users: true },
  });
  const manager = tenantA.users.find((u) => u.role === "MANAGER")!;
  const inactive = tenantA.users.find((u) => !u.isActive)!;

  try {
    console.log("\n[1] Access-token sign / verify / expiry");
    const tok = await signMobileToken({ sub: manager.id, rid: tenantA.id, did: "dev1", role: "MANAGER" });
    const payload = await verifyMobileToken(tok);
    check("verifies a valid token", payload?.sub === manager.id && payload?.rid === tenantA.id && payload?.did === "dev1");
    check("rejects a tampered signature", (await verifyMobileToken(tok.slice(0, -2) + "xy")) === null);
    check("rejects garbage", (await verifyMobileToken("not.a.token")) === null);
    const expired = await signMobileToken({ sub: manager.id, rid: tenantA.id, did: "d", role: "MANAGER" }, -10);
    check("rejects an expired token", (await verifyMobileToken(expired)) === null);

    console.log("\n[2] Login");
    const bad = await loginMobile(`mgr@${tag}.test`, "wrong");
    check("wrong password rejected", !bad.ok);
    check("unknown email rejected", !(await loginMobile(`nope@${tag}.test`, "password123")).ok);
    check("deactivated account rejected", !(await loginMobile(inactive.email, "password123")).ok);
    const login = await loginMobile(`mgr@${tag}.test`, "password123", { platform: "IOS", deviceName: "iPhone", pushToken: "ExpoTok1" });
    check("login returns a session", login.ok && !!login.session.accessToken && !!login.session.refreshToken, login);
    if (!login.ok) throw new Error("login failed");
    const session = login.session;
    check("session carries user + restaurant", session.user.id === manager.id && session.restaurant.id === tenantA.id);
    check("device created with push token", (await resolvePushTokens(tenantA.id, manager.id)).includes("ExpoTok1"));

    console.log("\n[3] Authenticate access token");
    const ctx = await authenticateMobile(bearer(session.accessToken).headers);
    check("authenticates to the right context", ctx?.userId === manager.id && ctx?.restaurantId === tenantA.id && ctx?.deviceId === session.deviceId);
    check("rejects an invalid bearer", (await authenticateMobile(bearer("garbage").headers)) === null);

    console.log("\n[4] Refresh rotation");
    const r1 = await refreshMobile(session.refreshToken);
    check("refresh issues new tokens", r1.ok && (r1 as { refreshToken: string }).refreshToken !== session.refreshToken);
    check("old refresh token is now invalid", !(await refreshMobile(session.refreshToken)).ok);
    if (r1.ok) {
      check("new access token authenticates", (await authenticateMobile(bearer(r1.accessToken).headers)) !== null);
    }

    console.log("\n[5] Logout / revocation");
    const currentRefresh = r1.ok ? r1.refreshToken : session.refreshToken;
    const currentAccess = r1.ok ? r1.accessToken : session.accessToken;
    check("logout revokes the device", (await logoutMobile(currentRefresh)).ok);
    check("access token rejected after logout", (await authenticateMobile(bearer(currentAccess).headers)) === null);
    check("refresh rejected after logout", !(await refreshMobile(currentRefresh)).ok);

    console.log("\n[6] Mobile gateway (RBAC over a real Request)");
    const fresh = await loginMobile(`mgr@${tag}.test`, "password123");
    if (!fresh.ok) throw new Error("re-login failed");
    const okRes = await handleMobileApi(bearer(fresh.session.accessToken), () => ok({ hi: true }));
    check("authenticated request → 200", okRes.status === 200);
    const noAuth = await handleMobileApi(new Request("https://x/m"), () => ok({}));
    check("missing token → 401", noAuth.status === 401);
    const forbidden = await handleMobileApi(bearer(fresh.session.accessToken), () => ok({}), { permission: "billing:manage" });
    check("manager lacks billing:manage → 403", forbidden.status === 403);
    const allowed = await handleMobileApi(bearer(fresh.session.accessToken), () => ok({}), { permission: "orders:view" });
    check("manager has orders:view → 200", allowed.status === 200);

    console.log("\n[7] Push tokens + provider-agnostic dispatch");
    check("push not configured by default", isPushConfigured() === false);
    check("buildExpoMessages shape", buildExpoMessages(["t1"], { title: "Hi", body: "There" })[0].to === "t1");
    check("register updates push token", (await registerPushToken(tenantA.id, fresh.session.deviceId, "ExpoTok2")).ok);
    check("resolve reflects updated token", (await resolvePushTokens(tenantA.id, manager.id)).includes("ExpoTok2"));
    const dispatch = await sendPushToUser(tenantA.id, manager.id, { title: "Test", body: "Body" });
    check("dispatch skips when unconfigured", dispatch.ok && dispatch.targeted >= 1 && dispatch.sent === 0 && dispatch.skipped >= 1, dispatch);
    check("listDevices returns the device", (await listDevices(tenantA.id, manager.id)).some((d) => d.id === fresh.session.deviceId));
    check("unregister clears token", (await unregisterPushToken(tenantA.id, fresh.session.deviceId)).ok);
    check("resolve empty after unregister", (await resolvePushTokens(tenantA.id, manager.id)).length === 0);

    console.log("\n[8] Offline delta sync");
    const cat = await prisma.category.create({ data: { restaurantId: tenantA.id, name: "Mains", slug: `mains-${tag}` } });
    const prodOld = await prisma.product.create({ data: { restaurantId: tenantA.id, name: "Old", slug: `old-${tag}`, price: new Prisma.Decimal(5), categoryId: cat.id } });
    await prisma.customer.create({ data: { restaurantId: tenantA.id, phone: `0900${tag}`, name: "Syncer" } });
    const full = await getSyncDelta(tenantA.id, null);
    check("full sync returns records + cursor", full.products.length >= 1 && full.categories.length >= 1 && full.customers.length >= 1 && typeof full.serverTime === "string");

    const cursor = new Date(full.serverTime);
    await new Promise((r) => setTimeout(r, 5));
    const prodNew = await prisma.product.create({ data: { restaurantId: tenantA.id, name: "New", slug: `new-${tag}`, price: new Prisma.Decimal(9) } });
    const delta = await getSyncDelta(tenantA.id, cursor);
    check("delta includes the new product", delta.products.some((p) => p.id === prodNew.id));
    check("delta excludes the unchanged product", !delta.products.some((p) => p.id === prodOld.id));

    await prisma.product.update({ where: { id: prodOld.id }, data: { deletedAt: new Date() } });
    const afterDelete = await getSyncDelta(tenantA.id, cursor);
    check("soft-deleted product appears as a tombstone", afterDelete.products.some((p) => p.id === prodOld.id && p.deleted === true));

    console.log("\n[9] Tenant isolation");
    const bSync = await getSyncDelta(tenantB.id, null);
    check("tenant B sync excludes tenant A products", !bSync.products.some((p) => p.id === prodNew.id));
    check("tenant B cannot resolve tenant A push tokens", (await resolvePushTokens(tenantB.id, manager.id)).length === 0);
    check("tenant B cannot register tenant A device", !(await registerPushToken(tenantB.id, fresh.session.deviceId, "X")).ok);
    const bCtx = await authenticateMobile(bearer(fresh.session.accessToken).headers);
    check("tenant A token resolves to tenant A only", bCtx?.restaurantId === tenantA.id);
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

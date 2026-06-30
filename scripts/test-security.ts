/**
 * End-to-end test for the Security module: TOTP 2FA (RFC 4226 vectors + the full
 * enable/verify/disable lifecycle with backup codes), IP allowlisting + CIDR,
 * generic/login rate limiting, login history, audit logs, session & device
 * management, WebAuthn ES256 assertion verification (synthetic-key round-trip),
 * and cross-tenant isolation.
 *
 * Run: npx tsx scripts/test-security.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { base32Decode, hotp, totp, verifyTotp } from "../src/lib/security/totp";
import { generateBackupCodes, hashBackupCodes, consumeBackupCode } from "../src/lib/security/backup-codes";
import { ipv4InCidr, ipAllowed, getClientIp } from "../src/lib/security/ip";
import { checkRateLimit, resetRateLimit } from "../src/lib/security/ratelimit";
import { startTwoFactorEnroll, confirmTwoFactor, verifyTwoFactor, disableTwoFactor } from "../src/lib/security/twofactor";
import { listSessions, revokeSession, revokeAllSessions } from "../src/lib/security/sessions";
import { recordAudit, listAudit } from "../src/lib/security/audit";
import { listLogins } from "../src/lib/security/login-history";
import { registerPasskey, listPasskeys, deletePasskey } from "../src/lib/security/passkeys";
import {
  buildRegistrationOptions,
  buildAuthenticationOptions,
  verifyAssertion,
  b64urlEncode,
} from "../src/lib/security/webauthn";
import { loginMobile } from "../src/lib/mobile/auth";

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

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource));
}
/** Convert a 64-byte P1363 ECDSA signature (Web Crypto output) to DER (WebAuthn). */
function rawToDer(raw: Uint8Array): Uint8Array {
  const toInt = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v: Uint8Array = b.slice(i);
    if (v[0] & 0x80) v = concat(new Uint8Array([0]), v);
    return concat(new Uint8Array([0x02, v.length]), v);
  };
  const r = toInt(raw.slice(0, 32));
  const s = toInt(raw.slice(32, 64));
  return concat(new Uint8Array([0x30, r.length + s.length]), r, s);
}

async function main() {
  const tag = `sec${Date.now().toString(36)}`;
  const pw = await bcrypt.hash("password123", 10);
  const tenantA = await prisma.restaurant.create({
    data: {
      slug: `${tag}-a`,
      name: "SA",
      ownerName: "A",
      users: {
        create: [
          { name: "U One", email: `u1@${tag}.test`, passwordHash: pw, role: "MANAGER" },
          { name: "U Two", email: `u2@${tag}.test`, passwordHash: pw, role: "CASHIER" },
        ],
      },
    },
    include: { users: true },
  });
  const tenantB = await prisma.restaurant.create({
    data: { slug: `${tag}-b`, name: "SB", ownerName: "B", users: { create: { name: "B1", email: `b1@${tag}.test`, passwordHash: pw, role: "MANAGER" } } },
    include: { users: true },
  });
  const u1 = tenantA.users.find((u) => u.email === `u1@${tag}.test`)!;
  const u2 = tenantA.users.find((u) => u.email === `u2@${tag}.test`)!;

  try {
    console.log("\n[1] TOTP — RFC 4226 vectors + base32");
    const rfcSecret = new TextEncoder().encode("12345678901234567890");
    check("base32 decodes the RFC secret", bytesEqual(base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"), rfcSecret));
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676"];
    let hotpOk = true;
    for (let i = 0; i < expected.length; i++) if ((await hotp(rfcSecret, i)) !== expected[i]) hotpOk = false;
    check("HOTP matches RFC 4226 counters 0-5", hotpOk);

    console.log("\n[2] TOTP verify + drift window");
    const t = 1_700_000_000_000;
    const secretB32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const code = await totp(secretB32, { time: t });
    check("verifies current code", await verifyTotp(secretB32, code, { time: t }));
    check("accepts previous step within window", await verifyTotp(secretB32, code, { time: t + 30_000, window: 1 }));
    check("rejects outside window", !(await verifyTotp(secretB32, code, { time: t + 120_000, window: 1 })));
    check("rejects malformed token", !(await verifyTotp(secretB32, "abc", { time: t })));

    console.log("\n[3] Backup codes");
    const codes = generateBackupCodes(10);
    check("generates 10 formatted codes", codes.length === 10 && /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(codes[0]));
    const hashes = await hashBackupCodes(codes);
    const c1 = await consumeBackupCode(hashes, codes[0].toLowerCase());
    check("consumes a code (case-insensitive) + reduces set", c1.ok && c1.remaining.length === 9);
    const c1again = await consumeBackupCode(c1.remaining, codes[0]);
    check("a consumed code cannot be reused", !c1again.ok);

    console.log("\n[4] IP allowlist + CIDR");
    check("inside /8", ipv4InCidr("10.1.2.3", "10.0.0.0/8"));
    check("inside /24", ipv4InCidr("10.0.0.55", "10.0.0.0/24"));
    check("outside range", !ipv4InCidr("11.0.0.1", "10.0.0.0/8"));
    check("empty allowlist allows all", ipAllowed("1.2.3.4", []));
    check("exact match allowed", ipAllowed("1.2.3.4", ["1.2.3.4"]));
    check("non-match denied", !ipAllowed("1.2.3.5", ["1.2.3.4"]));
    check("CIDR match allowed", ipAllowed("10.0.0.9", ["10.0.0.0/24"]));
    check("null IP fails closed when restricted", !ipAllowed(null, ["1.2.3.4"]));
    check("getClientIp takes first XFF hop", getClientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })) === "1.2.3.4");

    console.log("\n[5] Generic rate limiting");
    const bucket = `test:${tag}`;
    let allowedCount = 0;
    for (let i = 0; i < 4; i++) if ((await checkRateLimit(bucket, 3)).allowed) allowedCount++;
    check("allows up to the limit then blocks", allowedCount === 3);
    await resetRateLimit(bucket);
    check("reset re-opens the bucket", (await checkRateLimit(bucket, 3)).allowed);

    console.log("\n[6] 2FA lifecycle");
    const enroll = await startTwoFactorEnroll(tenantA.id, u1.id);
    check("enrollment returns a secret", enroll.ok && !!(enroll as { secret: string }).secret);
    const secret = enroll.ok ? enroll.secret : "";
    check("2FA not required before confirmation", (await verifyTwoFactor(tenantA.id, u1.id, undefined)).required === false);
    const confirm = await confirmTwoFactor(tenantA.id, u1.id, await totp(secret));
    check("confirm enables 2FA + issues backup codes", confirm.ok && (confirm as { backupCodes: string[] }).backupCodes.length === 10);
    check("TOTP passes step-up", (await verifyTwoFactor(tenantA.id, u1.id, await totp(secret))).ok === true);
    check("missing code now required + fails", (await verifyTwoFactor(tenantA.id, u1.id, undefined)).ok === false);
    if (confirm.ok) {
      const bc = confirm.backupCodes[0];
      check("backup code passes step-up", (await verifyTwoFactor(tenantA.id, u1.id, bc)).method === "backup");
      check("same backup code cannot be reused", (await verifyTwoFactor(tenantA.id, u1.id, bc)).ok === false);
    }
    check("cannot re-enroll while enabled", !(await startTwoFactorEnroll(tenantA.id, u1.id)).ok);
    check("disable 2FA", (await disableTwoFactor(tenantA.id, u1.id)).ok);
    check("not required after disable", (await verifyTwoFactor(tenantA.id, u1.id, undefined)).required === false);

    console.log("\n[7] Login history + login throttling (via mobile login)");
    const ip = "203.0.113.9";
    check("wrong password fails", !(await loginMobile(u2.email, "nope", {}, { ip })).ok);
    const good = await loginMobile(u2.email, "password123", {}, { ip });
    check("correct password logs in", good.ok);
    const logins = await listLogins(tenantA.id, { userId: u2.id });
    check("login history records success + failure", logins.some((l) => l.success) && logins.some((l) => !l.success));

    // Use a non-existent email so throttling doesn't lock out a real test user.
    const throttleEmail = `ghost-${tag}@nowhere.test`;
    let lastBlocked = false;
    for (let i = 0; i < 11; i++) {
      const r = await loginMobile(throttleEmail, "wrong", {}, { ip: "198.51.100.7" });
      lastBlocked = !r.ok && /too many/i.test(r.error);
    }
    check("login throttled after repeated failures", lastBlocked);

    console.log("\n[8] 2FA enforced at login");
    const e2 = await startTwoFactorEnroll(tenantA.id, u2.id);
    const s2 = e2.ok ? e2.secret : "";
    await confirmTwoFactor(tenantA.id, u2.id, await totp(s2));
    const noCode = await loginMobile(u2.email, "password123", {}, { ip });
    check("login without 2FA code is rejected", !noCode.ok && (noCode as { twoFactorRequired?: boolean }).twoFactorRequired === true);
    const withCode = await loginMobile(u2.email, "password123", {}, { ip, twoFactorCode: await totp(s2) });
    check("login with valid 2FA code succeeds", withCode.ok);
    await disableTwoFactor(tenantA.id, u2.id);

    console.log("\n[9] Session & device management");
    await loginMobile(u1.email, "password123", {}, { ip });
    let sessions = await listSessions(tenantA.id, u1.id);
    check("active sessions listed", sessions.length >= 1);
    const revoke = await revokeSession(tenantA.id, u1.id, sessions[0].id);
    check("single session revoked", revoke.ok);
    await loginMobile(u1.email, "password123", {}, { ip });
    await loginMobile(u1.email, "password123", {}, { ip });
    const before = await prisma.user.findUnique({ where: { id: u1.id }, select: { tokenVersion: true } });
    const all = await revokeAllSessions(tenantA.id, u1.id);
    const after = await prisma.user.findUnique({ where: { id: u1.id }, select: { tokenVersion: true } });
    check("revoke-all clears sessions + bumps tokenVersion", all.revoked >= 2 && (after?.tokenVersion ?? 0) === (before?.tokenVersion ?? 0) + 1);
    check("no active sessions after revoke-all", (await listSessions(tenantA.id, u1.id)).length === 0);

    console.log("\n[10] Audit log");
    await recordAudit({ restaurantId: tenantA.id, actorUserId: u1.id, action: "test.action", targetType: "thing", targetId: "x1" });
    const audits = await listAudit(tenantA.id, { action: "test.action" });
    check("audit entry recorded + listed", audits.length === 1 && audits[0].targetId === "x1");

    console.log("\n[11] WebAuthn — registration options + ES256 assertion round-trip");
    const regOpts = buildRegistrationOptions({ rpId: "example.com", rpName: "RestoPanel", userId: u1.id, userName: u1.email });
    check("registration options offer ES256", regOpts.pubKeyCredParams.some((p) => p.alg === -7) && !!regOpts.challenge);
    const authOpts = buildAuthenticationOptions({ rpId: "example.com", allowCredentialIds: ["abc"] });
    check("authentication options carry a challenge", !!authOpts.challenge && authOpts.rpId === "example.com");

    const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    const rpId = "example.com";
    const origin = "https://example.com";
    const challenge = authOpts.challenge;
    const rpIdHash = await sha256(new TextEncoder().encode(rpId));
    const authData = concat(rpIdHash, new Uint8Array([0x01]), new Uint8Array([0, 0, 0, 5])); // UP flag, counter=5
    const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge, origin }));
    const clientHash = await sha256(clientDataJSON);
    const signedData = concat(authData, clientHash);
    const rawSig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, signedData as unknown as BufferSource));

    const verified = await verifyAssertion({
      publicKey: b64urlEncode(rawPub),
      authenticatorData: b64urlEncode(authData),
      clientDataJSON: b64urlEncode(clientDataJSON),
      signature: b64urlEncode(rawToDer(rawSig)),
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRpId: rpId,
    });
    check("valid assertion verifies + reads counter", verified.ok && verified.counter === 5, verified);

    const badChallenge = await verifyAssertion({
      publicKey: b64urlEncode(rawPub),
      authenticatorData: b64urlEncode(authData),
      clientDataJSON: b64urlEncode(clientDataJSON),
      signature: b64urlEncode(rawToDer(rawSig)),
      expectedChallenge: "different",
      expectedOrigin: origin,
      expectedRpId: rpId,
    });
    check("challenge mismatch rejected", !badChallenge.ok);
    const tampered = await verifyAssertion({
      publicKey: b64urlEncode(rawPub),
      authenticatorData: b64urlEncode(authData),
      clientDataJSON: b64urlEncode(clientDataJSON),
      signature: b64urlEncode(rawToDer(new Uint8Array(rawSig).fill(0))),
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRpId: rpId,
    });
    check("tampered signature rejected", !tampered.ok);

    console.log("\n[12] Passkey storage + isolation");
    await registerPasskey({ userId: u1.id, restaurantId: tenantA.id, credentialId: `cred-${tag}`, publicKey: b64urlEncode(rawPub), label: "Test key" });
    check("passkey listed for owner", (await listPasskeys(tenantA.id, u1.id)).length === 1);

    console.log("\n[13] Tenant isolation");
    check("B cannot enroll A's user in 2FA", !(await startTwoFactorEnroll(tenantB.id, u1.id)).ok);
    check("B cannot see A's user 2FA state", (await verifyTwoFactor(tenantB.id, u1.id, "123456")).required === false);
    check("B sees none of A's sessions", (await listSessions(tenantB.id, u1.id)).length === 0);
    check("B cannot revoke A's session", !(await revokeSession(tenantB.id, u1.id, "anything")).ok);
    check("B audit log excludes A's entries", (await listAudit(tenantB.id, { action: "test.action" })).length === 0);
    check("B login history excludes A's", (await listLogins(tenantB.id, {})).every((l) => l.userId !== u1.id && l.userId !== u2.id));
    check("B sees none of A's passkeys", (await listPasskeys(tenantB.id, u1.id)).length === 0);
    check("B cannot delete A's passkey", !(await deletePasskey(tenantB.id, u1.id, "x")).ok);
  } finally {
    await prisma.restaurant.deleteMany({ where: { slug: { in: [`${tag}-a`, `${tag}-b`] } } });
    await prisma.securityRateWindow.deleteMany({ where: { bucket: { contains: tag } } });
    await prisma.loginEvent.deleteMany({ where: { email: { contains: `@${tag}.test` } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

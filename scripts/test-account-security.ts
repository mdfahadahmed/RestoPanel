/**
 * Security tests for the customer account: email verification (customer + owner
 * scope), login history recording, and the CSRF origin allowlist. Exercises the
 * real lib functions against the live database and cleans up after itself.
 *
 * Run: npx tsx scripts/test-account-security.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  createEmailVerificationToken,
  consumeEmailVerificationToken,
} from "../src/lib/security/email-verification";
import { recordCustomerLogin, listCustomerLogins } from "../src/lib/account/login-history";
import { isTrustedOrigin } from "../src/lib/security/origin";

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

function headers(init: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(init)) h.set(k, v);
  return h;
}

async function main() {
  const tag = `__sectest_${Date.now()}`;
  const custEmail = `${tag}-c@test.dev`;
  const ownerEmail = `${tag}-o@test.dev`;
  const slug = `${tag}-r`;

  const account = await prisma.customerAccount.create({
    data: { name: "Sec Cust", email: custEmail, passwordHash: "x" },
    select: { id: true },
  });
  const restaurant = await prisma.restaurant.create({
    data: {
      slug,
      name: "Sec Bistro",
      ownerName: "Owner",
      users: { create: { name: "Owner", email: ownerEmail, passwordHash: "x", role: "OWNER" } },
    },
    select: { id: true, users: { select: { id: true } } },
  });
  const ownerId = restaurant.users[0].id;

  try {
    console.log("\n[1] Email verification — customer scope");
    const t1 = await createEmailVerificationToken("customer", account.id, custEmail);
    check("token minted", typeof t1 === "string" && t1.length > 0);
    const before = await prisma.customerAccount.findUnique({ where: { id: account.id }, select: { emailVerifiedAt: true } });
    check("starts unverified", before?.emailVerifiedAt == null);

    const badVerify = await consumeEmailVerificationToken("not-a-token");
    check("garbage token rejected", !badVerify.ok);

    // Requesting a new token supersedes the old one.
    const t2 = await createEmailVerificationToken("customer", account.id, custEmail);
    check("second token differs", t2 !== t1);
    const stale = await consumeEmailVerificationToken(t1);
    check("superseded token rejected", !stale.ok);

    const ok = await consumeEmailVerificationToken(t2);
    check("valid token verifies", ok.ok && ok.scope === "customer" && ok.subjectId === account.id, ok);
    const after = await prisma.customerAccount.findUnique({ where: { id: account.id }, select: { emailVerifiedAt: true } });
    check("emailVerifiedAt stamped", after?.emailVerifiedAt != null);

    const replay = await consumeEmailVerificationToken(t2);
    check("used token cannot be replayed", !replay.ok);

    console.log("\n[2] Email verification — expiry + owner scope");
    const t3 = await createEmailVerificationToken("customer", account.id, custEmail);
    await prisma.emailVerificationToken.updateMany({
      where: { subjectId: account.id, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    check("expired token rejected", !(await consumeEmailVerificationToken(t3)).ok);

    const to = await createEmailVerificationToken("user", ownerId, ownerEmail);
    const okOwner = await consumeEmailVerificationToken(to);
    check("owner token verifies User scope", okOwner.ok && okOwner.scope === "user", okOwner);
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { emailVerifiedAt: true } });
    check("owner emailVerifiedAt stamped", owner?.emailVerifiedAt != null);

    console.log("\n[3] Login history");
    await recordCustomerLogin({ accountId: account.id, email: custEmail, success: true, ip: "1.2.3.4", userAgent: "Chrome" });
    await recordCustomerLogin({ email: custEmail, success: false, reason: "bad_credentials", ip: "9.9.9.9" });
    const myLogins = await listCustomerLogins(account.id, 20);
    check("account's successful login recorded", myLogins.length === 1 && myLogins[0].success, myLogins.length);
    check("failed attempt (no accountId) not shown under account", myLogins.every((l) => l.success));
    // Failed attempt is still recorded globally by email.
    const failedByEmail = await prisma.customerLoginEvent.count({ where: { email: custEmail, success: false } });
    check("failed attempt recorded by email", failedByEmail === 1, failedByEmail);

    console.log("\n[4] CSRF origin allowlist");
    check("same-origin allowed", isTrustedOrigin(headers({ origin: "http://localhost:3000", host: "localhost:3000" })));
    check("cross-origin rejected", !isTrustedOrigin(headers({ origin: "https://evil.example.com", host: "localhost:3000" })));
    check("missing origin fails open", isTrustedOrigin(headers({ host: "localhost:3000" })));
    check("malformed origin rejected", !isTrustedOrigin(headers({ origin: "://nope", host: "localhost:3000" })));
    check("referer used when origin absent", isTrustedOrigin(headers({ referer: "http://localhost:3000/x", host: "localhost:3000" })));
  } finally {
    await prisma.customerAccount.deleteMany({ where: { email: custEmail } });
    await prisma.restaurant.deleteMany({ where: { slug } });
    await prisma.emailVerificationToken.deleteMany({ where: { email: { in: [custEmail, ownerEmail] } } });
    await prisma.$disconnect();
  }

  console.log(`\n──────────────\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

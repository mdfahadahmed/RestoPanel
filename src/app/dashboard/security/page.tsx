import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { listSessions } from "@/lib/security/sessions";
import { listLogins } from "@/lib/security/login-history";
import { listPasskeys } from "@/lib/security/passkeys";
import {
  SecurityClient,
  type SessionRow,
  type LoginRow,
  type PasskeyRow,
} from "./SecurityClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const { restaurantId, userId } = await requireTenant();

  const [user, sessions, logins, passkeys] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabledAt: true } }),
    listSessions(restaurantId, userId),
    listLogins(restaurantId, { userId, limit: 20 }),
    listPasskeys(restaurantId, userId),
  ]);

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    platform: s.platform,
    deviceName: s.deviceName,
    lastSeenAt: s.lastSeenAt ? s.lastSeenAt.toISOString() : null,
  }));
  const loginRows: LoginRow[] = logins.map((l) => ({
    id: l.id,
    method: l.method,
    success: l.success,
    reason: l.reason,
    ip: l.ip,
    createdAt: l.createdAt.toISOString(),
  }));
  const passkeyRows: PasskeyRow[] = passkeys.map((p) => ({
    id: p.id,
    label: p.label,
    createdAt: p.createdAt.toISOString(),
    lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
  }));

  return (
    <SecurityClient
      twoFactorEnabled={user?.twoFactorEnabledAt != null}
      sessions={sessionRows}
      logins={loginRows}
      passkeys={passkeyRows}
    />
  );
}

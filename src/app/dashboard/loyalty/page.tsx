import { requireTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff/permissions";
import { ensureProgram, listMembers, findBirthdayCustomers, normaliseTiers } from "@/lib/loyalty/engine";
import {
  LoyaltyClient,
  type ProgramSettings,
  type MemberRow,
  type BirthdayRow,
} from "./LoyaltyClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Loyalty" };

export default async function LoyaltyPage() {
  const { restaurantId, role } = await requireTenant();
  const canManage = can(role, "customers:manage");

  const [restaurant, program, members, birthdays, stats] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { currency: true } }),
    ensureProgram(restaurantId),
    listMembers(restaurantId, 100),
    findBirthdayCustomers(restaurantId),
    prisma.customer.aggregate({
      where: { restaurantId, isMember: true },
      _count: { _all: true },
      _sum: { loyaltyPoints: true, cashbackBalance: true },
    }),
  ]);

  const settings: ProgramSettings = {
    isActive: program.isActive,
    pointsPerCurrency: Number(program.pointsPerCurrency),
    pointValue: Number(program.pointValue),
    minRedeemPoints: program.minRedeemPoints,
    cashbackPercent: Number(program.cashbackPercent),
    birthdayBonusPoints: program.birthdayBonusPoints,
  };

  const memberRows: MemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    loyaltyPoints: m.loyaltyPoints,
    lifetimePoints: m.lifetimePoints,
    cashbackBalance: Number(m.cashbackBalance),
    vipTier: m.vipTier,
    birthday: m.birthday ? m.birthday.toISOString() : null,
  }));

  const birthdayRows: BirthdayRow[] = birthdays.map((b) => ({
    id: b.id,
    name: b.name,
    phone: b.phone,
    vipTier: b.vipTier,
  }));

  return (
    <LoyaltyClient
      currency={restaurant?.currency ?? "GBP"}
      canManage={canManage}
      settings={settings}
      tiers={normaliseTiers(program.tiers)}
      members={memberRows}
      birthdays={birthdayRows}
      memberCount={stats._count._all}
      pointsOutstanding={stats._sum.loyaltyPoints ?? 0}
      cashbackLiability={Number(stats._sum.cashbackBalance ?? 0)}
    />
  );
}

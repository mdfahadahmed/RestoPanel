"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, Gift, Star, Wallet, Cake } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { VipTier } from "@/lib/loyalty/shared";
import { LoyaltyMemberDialog } from "./LoyaltyMemberDialog";
import { saveLoyaltyProgram, grantBirthday } from "./actions";

export interface ProgramSettings {
  isActive: boolean;
  pointsPerCurrency: number;
  pointValue: number;
  minRedeemPoints: number;
  cashbackPercent: number;
  birthdayBonusPoints: number;
}
export interface MemberRow {
  id: string;
  name: string | null;
  phone: string;
  loyaltyPoints: number;
  lifetimePoints: number;
  cashbackBalance: number;
  vipTier: string;
  birthday: string | null;
}
export interface BirthdayRow {
  id: string;
  name: string | null;
  phone: string;
  vipTier: string;
}

const TIER_BADGE: Record<string, "gold" | "violet" | "sky" | "emerald" | "outline"> = {
  Platinum: "violet",
  Gold: "gold",
  Silver: "sky",
  Bronze: "outline",
};

interface LoyaltyClientProps {
  currency: string;
  canManage: boolean;
  settings: ProgramSettings;
  tiers: VipTier[];
  members: MemberRow[];
  birthdays: BirthdayRow[];
  memberCount: number;
  pointsOutstanding: number;
  cashbackLiability: number;
}

export function LoyaltyClient(props: LoyaltyClientProps) {
  const { currency, canManage } = props;
  const money = (n: number) => formatCurrency(n, currency);
  const [selected, setSelected] = useState<MemberRow | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Loyalty" description="Reward points, membership, VIP tiers, cashback and birthday offers." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Members" value={props.memberCount} icon={Star} accent="text-violet-300" />
        <StatCard label="Points outstanding" value={props.pointsOutstanding.toLocaleString()} icon={Gift} accent="text-gold-300" />
        <StatCard label="Cashback liability" value={money(props.cashbackLiability)} icon={Wallet} accent="text-emerald-300" />
      </div>

      {canManage && <ProgramForm settings={props.settings} />}

      <VipTiers tiers={props.tiers} />

      {canManage && <BirthdayPanel birthdays={props.birthdays} />}

      <Members members={props.members} currency={currency} canManage={canManage} onSelect={setSelected} />

      {canManage && <LoyaltyMemberDialog member={selected} currency={currency} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ProgramForm({ settings }: { settings: ProgramSettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);

  function num(key: keyof ProgramSettings) {
    return {
      value: String(s[key] as number),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setS({ ...s, [key]: Number(e.target.value) || 0 }),
    };
  }

  async function save() {
    setBusy(true);
    const res = await saveLoyaltyProgram(s);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Loyalty settings saved");
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">Program settings</h2>
        <label className="flex items-center gap-2 text-sm text-fog-200">
          <input
            type="checkbox"
            checked={s.isActive}
            onChange={(e) => setS({ ...s, isActive: e.target.checked })}
            className="size-4 rounded border-line bg-ink-800"
          />
          Active
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Points per 1 spent">
          <Input type="number" min={0} step="0.1" {...num("pointsPerCurrency")} />
        </Field>
        <Field label="Value of 1 point">
          <Input type="number" min={0} step="0.001" {...num("pointValue")} />
        </Field>
        <Field label="Min points to redeem">
          <Input type="number" min={0} {...num("minRedeemPoints")} />
        </Field>
        <Field label="Cashback %">
          <Input type="number" min={0} max={100} step="0.5" {...num("cashbackPercent")} />
        </Field>
        <Field label="Birthday bonus points">
          <Input type="number" min={0} {...num("birthdayBonusPoints")} />
        </Field>
      </div>

      <div className="mt-4">
        <Button variant="primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function VipTiers({ tiers }: { tiers: VipTier[] }) {
  return (
    <section className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-center gap-2">
        <Crown className="size-4 text-gold-300" />
        <h2 className="font-semibold tracking-tight">VIP levels</h2>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((t) => (
          <div key={t.name} className="rounded-xl border border-line bg-ink-850 p-3">
            <Badge variant={TIER_BADGE[t.name] ?? "outline"}>{t.name}</Badge>
            <p className="mt-2 text-sm text-fog-300">From {t.minLifetimePoints.toLocaleString()} pts</p>
            <p className="text-sm font-semibold text-fog-100">{t.multiplier}× points</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function BirthdayPanel({ birthdays }: { birthdays: BirthdayRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function grant(id: string) {
    setBusy(id);
    const res = await grantBirthday({ customerId: id });
    setBusy(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Birthday bonus granted (${res.data?.points ?? 0} pts)`);
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-center gap-2">
        <Cake className="size-4 text-rose-300" />
        <h2 className="font-semibold tracking-tight">Birthdays today</h2>
      </div>
      {birthdays.length === 0 ? (
        <p className="mt-2 text-sm text-fog-500">No customer birthdays today.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {birthdays.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="text-fog-100">{b.name ?? b.phone}</span>
              <Button size="sm" variant="secondary" disabled={busy === b.id} onClick={() => grant(b.id)}>
                <Gift className="size-4" /> Grant bonus
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Members({
  members,
  currency,
  canManage,
  onSelect,
}: {
  members: MemberRow[];
  currency: string;
  canManage: boolean;
  onSelect: (m: MemberRow) => void;
}) {
  const money = (n: number) => formatCurrency(n, currency);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (m) => (m.name ?? "").toLowerCase().includes(query) || m.phone.includes(query)
    );
  }, [members, q]);

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="font-semibold tracking-tight">Members</h2>
        <Input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
      </div>
      <ul className="divide-y divide-line">
        {filtered.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fog-100">{m.name ?? m.phone}</p>
              <p className="truncate text-xs text-fog-500">{m.phone}</p>
            </div>
            <Badge variant={TIER_BADGE[m.vipTier] ?? "outline"}>{m.vipTier}</Badge>
            <span className="w-20 text-right text-sm text-gold-300">{m.loyaltyPoints.toLocaleString()} pts</span>
            <span className="w-20 text-right text-sm text-emerald-300">{money(m.cashbackBalance)}</span>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => onSelect(m)}>
                Manage
              </Button>
            )}
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-fog-500">No members yet</li>
        )}
      </ul>
    </section>
  );
}

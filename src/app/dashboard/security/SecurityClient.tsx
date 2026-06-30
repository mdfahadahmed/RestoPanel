"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Smartphone, KeyRound, History, Trash2, LogOut } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  start2FA,
  confirm2FA,
  disable2FA,
  revokeSessionAction,
  revokeAllSessionsAction,
  deletePasskeyAction,
} from "./actions";

export interface SessionRow {
  id: string;
  platform: string;
  deviceName: string | null;
  lastSeenAt: string | null;
}
export interface LoginRow {
  id: string;
  method: string;
  success: boolean;
  reason: string | null;
  ip: string | null;
  createdAt: string;
}
export interface PasskeyRow {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface Props {
  twoFactorEnabled: boolean;
  sessions: SessionRow[];
  logins: LoginRow[];
  passkeys: PasskeyRow[];
}

export function SecurityClient({ twoFactorEnabled, sessions, logins, passkeys }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Two-factor authentication, passkeys, sessions and login history." />
      <TwoFactorCard enabled={twoFactorEnabled} />
      <PasskeysCard passkeys={passkeys} />
      <SessionsCard sessions={sessions} />
      <LoginHistoryCard logins={logins} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [enroll, setEnroll] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  async function begin() {
    setBusy(true);
    const res = await start2FA();
    setBusy(false);
    if (!res.ok || !res.data) toast.error(res.ok ? "Failed" : res.error);
    else setEnroll(res.data);
  }

  async function confirm() {
    setBusy(true);
    const res = await confirm2FA({ token: code });
    setBusy(false);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? "Failed" : res.error);
      return;
    }
    setBackupCodes(res.data.backupCodes);
    setEnroll(null);
    setCode("");
    toast.success("Two-factor enabled");
    router.refresh();
  }

  async function turnOff() {
    setBusy(true);
    const res = await disable2FA();
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Two-factor disabled");
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled ? <ShieldCheck className="size-5 text-emerald-300" /> : <ShieldOff className="size-5 text-fog-400" />}
          <h2 className="font-semibold tracking-tight">Two-factor authentication</h2>
        </div>
        {enabled ? <Badge variant="emerald">Enabled</Badge> : <Badge variant="outline">Off</Badge>}
      </div>

      {backupCodes && (
        <div className="mt-3 rounded-xl border border-gold-400/30 bg-gold-400/10 p-3">
          <p className="text-sm font-medium text-gold-200">Save your recovery codes</p>
          <p className="mb-2 text-xs text-fog-400">Each code works once. Store them somewhere safe.</p>
          <div className="grid grid-cols-2 gap-1 font-mono text-sm text-fog-100">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {!enabled && !enroll && (
        <div className="mt-3">
          <p className="text-sm text-fog-400">Add a one-time code from an authenticator app to your login.</p>
          <Button className="mt-3" variant="primary" disabled={busy} onClick={begin}>
            Enable 2FA
          </Button>
        </div>
      )}

      {!enabled && enroll && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-fog-300">
            Scan this in your authenticator app, or enter the secret manually, then type the 6-digit code.
          </p>
          <code className="block break-all rounded-lg bg-ink-950 px-3 py-2 text-sm text-fog-100">{enroll.secret}</code>
          <a href={enroll.otpauthUrl} className="text-sm text-violet-300 hover:underline">
            Open in authenticator app
          </a>
          <div className="flex items-center gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" inputMode="numeric" className="w-40" />
            <Button variant="primary" disabled={busy || code.length < 6} onClick={confirm}>
              Verify & enable
            </Button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="mt-3">
          <Button variant="destructive" disabled={busy} onClick={turnOff}>
            Disable 2FA
          </Button>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function PasskeysCard({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  async function remove(id: string) {
    const res = await deletePasskeyAction({ id });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Passkey removed");
      router.refresh();
    }
  }
  return (
    <section className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-violet-300" />
        <h2 className="font-semibold tracking-tight">Passkeys</h2>
      </div>
      <p className="mt-1 text-sm text-fog-400">
        Sign in with Face ID / Touch ID / a security key. Registration uses your device&apos;s WebAuthn prompt.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {passkeys.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium text-fog-100">{p.label ?? "Passkey"}</p>
              <p className="text-xs text-fog-500">
                Added {formatDate(p.createdAt)}
                {p.lastUsedAt ? ` · last used ${formatDate(p.lastUsedAt)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(p.id)}
              aria-label="Remove passkey"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-400 hover:bg-ink-800 hover:text-rose-300"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {passkeys.length === 0 && <li className="py-4 text-sm text-fog-500">No passkeys registered yet.</li>}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function SessionsCard({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke(deviceId: string) {
    const res = await revokeSessionAction({ deviceId });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Session revoked");
      router.refresh();
    }
  }
  async function revokeAll() {
    setBusy(true);
    const res = await revokeAllSessionsAction();
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Signed out ${res.data?.revoked ?? 0} device(s)`);
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="size-5 text-sky-300" />
          <h2 className="font-semibold tracking-tight">Active sessions</h2>
        </div>
        {sessions.length > 0 && (
          <Button size="sm" variant="outline" disabled={busy} onClick={revokeAll}>
            <LogOut className="size-4" /> Sign out everywhere
          </Button>
        )}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium text-fog-100">{s.deviceName ?? s.platform}</p>
              <p className="text-xs text-fog-500">
                {s.platform}
                {s.lastSeenAt ? ` · last active ${formatDate(s.lastSeenAt)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => revoke(s.id)}
              aria-label="Revoke session"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-400 hover:bg-ink-800 hover:text-rose-300"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {sessions.length === 0 && <li className="py-4 text-sm text-fog-500">No active device sessions.</li>}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function LoginHistoryCard({ logins }: { logins: LoginRow[] }) {
  return (
    <section className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-center gap-2">
        <History className="size-5 text-fog-300" />
        <h2 className="font-semibold tracking-tight">Login history</h2>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {logins.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="text-fog-100">
                {formatDate(l.createdAt)} · <span className="text-fog-400">{l.method}</span>
              </p>
              <p className="text-xs text-fog-500">
                {l.ip ?? "unknown IP"}
                {!l.success && l.reason ? ` · ${l.reason}` : ""}
              </p>
            </div>
            <Badge variant={l.success ? "emerald" : "rose"}>{l.success ? "Success" : "Failed"}</Badge>
          </li>
        ))}
        {logins.length === 0 && <li className="py-4 text-sm text-fog-500">No login activity yet.</li>}
      </ul>
    </section>
  );
}

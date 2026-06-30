"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Pencil, Trash2, Clock, CalendarPlus, Check, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  ROLE_LABELS,
  PERMISSION_LABELS,
  ASSIGNABLE_ROLES,
  can,
  type Permission,
} from "@/lib/staff/permissions";
import { formatMinutes, workedMinutes } from "@/lib/staff/shared";
import { StaffFormDialog } from "./StaffFormDialog";
import {
  clockInOut,
  deleteStaffMember,
  createShiftAction,
  deleteShiftAction,
} from "./actions";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
}
export interface ShiftRow {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  startAt: string;
  endAt: string;
  position: string | null;
  note: string | null;
}
export interface AttendanceRow {
  id: string;
  userName: string;
  userRole: string;
  clockInAt: string;
  clockOutAt: string | null;
  workedMins: number | null;
}

const ROLE_BADGE: Record<string, "violet" | "emerald" | "amber" | "sky" | "rose" | "gold" | "outline"> = {
  OWNER: "gold",
  MANAGER: "violet",
  CASHIER: "sky",
  KITCHEN: "amber",
  WAITER: "emerald",
  DELIVERY: "rose",
  STAFF: "outline",
};

interface StaffBoardProps {
  role: Role;
  canManage: boolean;
  canSchedule: boolean;
  canSeeAttendance: boolean;
  myOpenSince: string | null;
  staff: StaffMember[];
  shifts: ShiftRow[];
  myShifts: ShiftRow[];
  attendance: AttendanceRow[];
}

export function StaffBoard(props: StaffBoardProps) {
  const { canManage, canSchedule, canSeeAttendance } = props;

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Team, roles, attendance and shifts." />

      <MyAttendance openSince={props.myOpenSince} />

      {canManage && <Roster staff={props.staff} />}
      {canSchedule && <ShiftScheduler staff={props.staff} shifts={props.shifts} />}
      {!canSchedule && <MyShifts shifts={props.myShifts} />}
      {canSeeAttendance && <AttendanceReport rows={props.attendance} />}

      <PermissionMatrix />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function MyAttendance({ openSince }: { openSince: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!openSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [openSince]);

  const elapsed = openSince ? workedMinutes(openSince, new Date(now)) : 0;

  async function toggle() {
    setBusy(true);
    const res = await clockInOut(openSince ? "out" : "in");
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(openSince ? "Clocked out" : "Clocked in");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-900/50 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            openSince ? "bg-emerald-400/15 text-emerald-300" : "bg-ink-800 text-fog-400"
          )}
        >
          <Clock className="size-5" />
        </span>
        <div>
          <p className="font-semibold text-fog-100">My attendance</p>
          <p className="text-sm text-fog-400">
            {openSince ? `Clocked in · ${formatMinutes(elapsed)} elapsed` : "You are clocked out"}
          </p>
        </div>
      </div>
      <Button variant={openSince ? "secondary" : "primary"} disabled={busy} onClick={toggle}>
        {openSince ? "Clock out" : "Clock in"}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Roster({ staff }: { staff: StaffMember[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  async function remove(member: StaffMember) {
    if (!confirm(`Remove ${member.name}? This cannot be undone.`)) return;
    const res = await deleteStaffMember({ userId: member.id });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Staff removed");
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold tracking-tight">Team</h2>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <UserPlus className="size-4" /> Add staff
        </Button>
      </div>
      <ul className="divide-y divide-line">
        {staff.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fog-100">{m.name}</p>
              <p className="truncate text-xs text-fog-500">{m.email}</p>
            </div>
            <Badge variant={ROLE_BADGE[m.role] ?? "outline"}>{ROLE_LABELS[m.role]}</Badge>
            {!m.isActive && <Badge variant="rose">Inactive</Badge>}
            <button
              type="button"
              onClick={() => {
                setEditing(m);
                setDialogOpen(true);
              }}
              aria-label={`Edit ${m.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-300 hover:bg-ink-800"
            >
              <Pencil className="size-4" />
            </button>
            {m.role !== "OWNER" && (
              <button
                type="button"
                onClick={() => remove(m)}
                aria-label={`Remove ${m.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-400 hover:bg-ink-800 hover:text-rose-300"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
        {staff.length === 0 && <li className="px-4 py-8 text-center text-sm text-fog-500">No staff yet</li>}
      </ul>

      <StaffFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} member={editing} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function ShiftScheduler({ staff, shifts }: { staff: StaffMember[]; shifts: ShiftRow[] }) {
  const router = useRouter();
  const activeStaff = useMemo(() => staff.filter((s) => s.isActive), [staff]);
  const [userId, setUserId] = useState(activeStaff[0]?.id ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [position, setPosition] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!userId || !startAt || !endAt) {
      toast.error("Pick a staff member and times");
      return;
    }
    setBusy(true);
    const res = await createShiftAction({ userId, startAt, endAt, position });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Shift scheduled");
      setStartAt("");
      setEndAt("");
      setPosition("");
      router.refresh();
    }
  }

  async function remove(id: string) {
    const res = await deleteShiftAction({ shiftId: id });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Shift removed");
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold tracking-tight">Shifts</h2>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-b border-line p-4">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          aria-label="Staff member"
          className="h-9 rounded-xl border border-line bg-ink-800/70 px-2 text-sm text-fog-100"
        >
          {activeStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          aria-label="Shift start"
          className="h-9 rounded-xl border border-line bg-ink-800/70 px-2 text-sm text-fog-100"
        />
        <input
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
          aria-label="Shift end"
          className="h-9 rounded-xl border border-line bg-ink-800/70 px-2 text-sm text-fog-100"
        />
        <Input
          placeholder="Position (optional)"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="h-9 w-40"
        />
        <Button size="sm" variant="primary" disabled={busy} onClick={add}>
          <CalendarPlus className="size-4" /> Schedule
        </Button>
      </div>

      <ul className="divide-y divide-line">
        {shifts.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-fog-100">
                {s.userName}
                {s.position ? <span className="text-fog-500"> · {s.position}</span> : null}
              </p>
              <p className="text-xs text-fog-500">
                {formatDate(s.startAt)} → {formatDate(s.endAt, { day: undefined, month: undefined, year: undefined })}
              </p>
            </div>
            <Badge variant={ROLE_BADGE[s.userRole] ?? "outline"}>{ROLE_LABELS[s.userRole as Role]}</Badge>
            <button
              type="button"
              onClick={() => remove(s.id)}
              aria-label="Remove shift"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fog-400 hover:bg-ink-800 hover:text-rose-300"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {shifts.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-fog-500">No upcoming shifts</li>
        )}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function MyShifts({ shifts }: { shifts: ShiftRow[] }) {
  return (
    <section className="rounded-2xl border border-line bg-ink-900/40">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold tracking-tight">My shifts</h2>
      </div>
      <ul className="divide-y divide-line">
        {shifts.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-fog-100">
              {formatDate(s.startAt)} → {formatDate(s.endAt, { day: undefined, month: undefined, year: undefined })}
            </span>
            {s.position && <span className="text-fog-500">{s.position}</span>}
          </li>
        ))}
        {shifts.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-fog-500">No upcoming shifts</li>
        )}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function AttendanceReport({ rows }: { rows: AttendanceRow[] }) {
  return (
    <section className="rounded-2xl border border-line bg-ink-900/40">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold tracking-tight">Today&apos;s attendance</h2>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-fog-100">{a.userName}</span>
            <span className="text-fog-400">{formatDate(a.clockInAt, { day: undefined, month: undefined, year: undefined })}</span>
            <span className="text-fog-500">→</span>
            <span className="text-fog-400">
              {a.clockOutAt ? formatDate(a.clockOutAt, { day: undefined, month: undefined, year: undefined }) : "—"}
            </span>
            <span className="w-20 text-right font-medium text-fog-200">
              {a.workedMins != null ? formatMinutes(a.workedMins) : "in progress"}
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-fog-500">No attendance today</li>
        )}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function PermissionMatrix() {
  const roles: Role[] = ["OWNER", ...ASSIGNABLE_ROLES];
  const permissions = Object.keys(PERMISSION_LABELS) as Permission[];

  return (
    <section className="rounded-2xl border border-line bg-ink-900/40">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-semibold tracking-tight">Role permissions</h2>
        <p className="text-sm text-fog-400">What each role can access.</p>
      </div>
      <div className="overflow-x-auto p-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left font-medium text-fog-400">Permission</th>
              {roles.map((r) => (
                <th key={r} className="px-2 py-2 text-center font-medium text-fog-300">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p} className="border-t border-line/60">
                <td className="px-2 py-1.5 text-fog-200">{PERMISSION_LABELS[p]}</td>
                {roles.map((r) => (
                  <td key={r} className="px-2 py-1.5 text-center">
                    {can(r, p) ? (
                      <Check className="mx-auto size-4 text-emerald-400" />
                    ) : (
                      <X className="mx-auto size-4 text-fog-600" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

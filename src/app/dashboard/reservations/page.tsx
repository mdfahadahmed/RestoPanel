import Link from "next/link";
import { CalendarCheck, Clock, CalendarDays, Utensils, Armchair, Settings } from "lucide-react";
import type { ReservationStatus } from "@prisma/client";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { ParamTabs } from "@/components/admin/ParamTabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { requireTenant } from "@/lib/tenant";
import {
  listReservations, getReservationStats, getCalendarCounts,
} from "@/lib/reservations/bookings";
import { listActiveTables } from "@/lib/reservations/tables";
import { formatNumber } from "@/lib/admin/format";
import { reservationStatusVariant, RESERVATION_STATUS_LABEL } from "./status";
import { ReservationCalendar } from "./ReservationCalendar";
import { NewReservationDialog } from "./NewReservationDialog";
import { ReservationRowActions } from "./ReservationRowActions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Seated", value: "SEATED" },
  { label: "Completed", value: "COMPLETED" },
];
const SCOPE_OPTIONS = [
  { label: "Upcoming", value: "upcoming" },
  { label: "History", value: "history" },
  { label: "All", value: "all" },
];

function timeOf(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function dayOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; scope?: string; q?: string; page?: string; date?: string; year?: string; month?: string }>;
}) {
  const { restaurantId } = await requireTenant();
  const sp = await searchParams;
  const now = new Date();
  const page = Math.max(1, Number(sp.page) || 1);
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const scope = (sp.scope as "upcoming" | "history" | "all") ?? "upcoming";

  const [{ rows, total, pageCount, perPage }, stats, counts, tables] = await Promise.all([
    listReservations(restaurantId, {
      status: (sp.status as ReservationStatus | "ALL") ?? "ALL",
      scope,
      search: sp.q,
      date: sp.date,
      page,
      now,
    }),
    getReservationStats(restaurantId, now),
    getCalendarCounts(restaurantId, year, month),
    listActiveTables(restaurantId),
  ]);

  const tableOptions = tables.map((t) => ({ id: t.id, name: t.name, capacity: t.capacity }));

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Reservations"
        description="Bookings, table availability and approvals."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline"><Link href="/dashboard/reservations/tables"><Armchair className="h-4 w-4" /> Tables</Link></Button>
            <Button asChild variant="outline"><Link href="/dashboard/reservations/settings"><Settings className="h-4 w-4" /> Settings</Link></Button>
            <NewReservationDialog tables={tableOptions} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={formatNumber(stats.today)} icon={CalendarCheck} />
        <StatCard label="Pending approval" value={formatNumber(stats.pending)} icon={Clock} accent="text-amber-300" />
        <StatCard label="Upcoming" value={formatNumber(stats.upcoming)} icon={CalendarDays} />
        <StatCard label="Seated now" value={formatNumber(stats.seated)} icon={Utensils} accent="text-violet-300" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ReservationCalendar year={year} month={month} counts={counts} selectedDate={sp.date} />
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput placeholder="Search name, phone, ref…" />
            {!sp.date && <ParamTabs paramKey="scope" options={SCOPE_OPTIONS} defaultValue="upcoming" />}
          </div>
          <ParamTabs paramKey="status" options={STATUS_OPTIONS} />

          {sp.date && (
            <p className="text-sm text-fog-400">
              Showing {sp.date}. <Link href="/dashboard/reservations" className="text-violet-400 hover:underline">Clear</Link>
            </p>
          )}

          {rows.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No reservations" description="Bookings will appear here." />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-fog-100">{r.name}</div>
                        <div className="text-xs text-fog-500">
                          {r.phone}{r.reference ? ` · ${r.reference}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {dayOf(r.date)} <span className="text-fog-400">{timeOf(r.date)}</span>
                      </TableCell>
                      <TableCell>{r.partySize}</TableCell>
                      <TableCell className="text-fog-300">{r.table?.name ?? "—"}</TableCell>
                      <TableCell><Badge variant={reservationStatusVariant(r.status)}>{RESERVATION_STATUS_LABEL[r.status]}</Badge></TableCell>
                      <TableCell className="text-right">
                        <ReservationRowActions
                          reservation={{
                            id: r.id, status: r.status, date: r.date.toISOString(),
                            time: timeOf(r.date), dateOnly: dayOf(r.date),
                            partySize: r.partySize, tableId: r.tableId,
                          }}
                          tables={tableOptions}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} totalPages={pageCount} totalItems={total} pageSize={perPage} />
            </Card>
          )}
        </div>
      </div>
    </GsapReveal>
  );
}

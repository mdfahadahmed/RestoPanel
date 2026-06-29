import Link from "next/link";
import { LifeBuoy, MessageSquare } from "lucide-react";
import type { TicketStatus } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { ParamTabs } from "@/components/admin/ParamTabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listTickets } from "@/lib/admin/support";
import {
  formatDateTime,
  formatNumber,
  ticketPriorityVariant,
  ticketStatusVariant,
} from "@/lib/admin/format";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Pending", value: "PENDING" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
];

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (sp.status as TicketStatus | "ALL") ?? "ALL";

  const { rows, total, pageCount, perPage, openCount, pendingCount } =
    await listTickets({ search: sp.q, status, page });

  return (
    <>
      <PageHeader title="Support" description="Tenant support tickets and conversations." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open" value={formatNumber(openCount)} icon={LifeBuoy} accent="text-sky-300" />
        <StatCard label="Awaiting reply" value={formatNumber(pendingCount)} icon={MessageSquare} accent="text-amber-300" />
        <StatCard label="Total tickets" value={formatNumber(total)} icon={LifeBuoy} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search subject, requester…" />
        <ParamTabs paramKey="status" options={STATUS_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No tickets" description="No tickets match this filter." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/admin/support/${t.id}`} className="font-medium text-fog-100 hover:text-violet-300">
                      {t.subject}
                    </Link>
                    <div className="text-xs text-fog-600">{t._count.messages} message{t._count.messages === 1 ? "" : "s"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-fog-200">{t.requesterName}</div>
                    <div className="text-xs text-fog-500">{t.requesterEmail}</div>
                  </TableCell>
                  <TableCell className="text-fog-300">{t.restaurant?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={ticketPriorityVariant(t.priority)}>{t.priority.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ticketStatusVariant(t.status)}>{t.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-fog-400">{formatDateTime(t.lastMessageAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={pageCount} totalItems={total} pageSize={perPage} />
        </Card>
      )}
    </>
  );
}

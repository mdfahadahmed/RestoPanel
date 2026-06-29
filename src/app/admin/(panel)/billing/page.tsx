import Link from "next/link";
import { ReceiptText, PoundSterling, AlertCircle } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
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
import { listInvoices, getBillingSummary } from "@/lib/admin/billing";
import {
  formatDate,
  formatMoney,
  formatMoney2,
  formatNumber,
  invoiceStatusVariant,
} from "@/lib/admin/format";
import { InvoiceRowActions } from "./InvoiceRowActions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Paid", value: "PAID" },
  { label: "Open", value: "OPEN" },
  { label: "Void", value: "VOID" },
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (sp.status as InvoiceStatus | "ALL") ?? "ALL";

  const [{ rows, total, pageCount, perPage }, summary] = await Promise.all([
    listInvoices({ status, page }),
    getBillingSummary(),
  ]);

  return (
    <>
      <PageHeader title="Billing" description="Platform invoices and collections." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(summary.paidTotal)} icon={PoundSterling} accent="text-emerald-300" />
        <StatCard label="Outstanding" value={formatMoney(summary.outstanding)} icon={AlertCircle} accent="text-amber-300" />
        <StatCard label="Paid invoices" value={formatNumber(summary.paidCount)} icon={ReceiptText} />
        <StatCard label="Open invoices" value={formatNumber(summary.openCount)} icon={ReceiptText} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fog-300">Invoices ({formatNumber(total)})</h2>
        <ParamTabs paramKey="status" options={STATUS_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No invoices" description="No invoices match this filter." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number}</TableCell>
                  <TableCell>
                    {inv.restaurant ? (
                      <Link href={`/admin/restaurants/${inv.restaurantId}`} className="text-fog-200 hover:text-violet-300">
                        {inv.restaurant.name}
                      </Link>
                    ) : (
                      <span className="text-fog-600">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatMoney2(Number(inv.amount), inv.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={invoiceStatusVariant(inv.status)}>{inv.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-fog-400">{formatDate(inv.issuedAt)}</TableCell>
                  <TableCell className="text-xs text-fog-400">
                    {inv.paidAt ? formatDate(inv.paidAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <InvoiceRowActions id={inv.id} status={inv.status} />
                  </TableCell>
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

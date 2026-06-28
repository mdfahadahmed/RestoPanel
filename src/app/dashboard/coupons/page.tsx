import { Plus, TicketPercent } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { GsapReveal } from "@/components/dashboard/GsapReveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CouponType } from "@/lib/validations/coupon";
import { CouponFormDialog, type CouponFormValues } from "./CouponFormDialog";
import { CouponRowActions } from "./CouponRowActions";

export const dynamic = "force-dynamic";

type Status = { label: string; variant: "emerald" | "amber" | "rose" | "outline" };

function couponStatus(c: {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
}): Status {
  const now = new Date();
  if (!c.isActive) return { label: "Inactive", variant: "outline" };
  if (c.endsAt && now > c.endsAt) return { label: "Expired", variant: "rose" };
  if (c.startsAt && now < c.startsAt) return { label: "Scheduled", variant: "amber" };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { label: "Used up", variant: "rose" };
  return { label: "Active", variant: "emerald" };
}

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function CouponsPage() {
  const { restaurantId } = await requireTenant();
  const coupons = await prisma.coupon.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" } });

  return (
    <GsapReveal className="space-y-6">
      <PageHeader
        title="Coupons"
        description="Create and manage discount codes for your customers."
        action={
          <CouponFormDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> New coupon
              </Button>
            }
          />
        }
      />

      {coupons.length === 0 ? (
        <EmptyState
          icon={TicketPercent}
          title="No coupons yet"
          description="Create your first discount code to boost orders."
          action={
            <CouponFormDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4" /> New coupon
                </Button>
              }
            />
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min. order</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const status = couponStatus(c);
                const formValues: CouponFormValues & { isActive: boolean } = {
                  id: c.id,
                  code: c.code,
                  type: c.type as CouponType,
                  value: String(Number(c.value)),
                  minimumOrder: String(Number(c.minimumOrder)),
                  usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
                  startsAt: toDateInput(c.startsAt),
                  endsAt: toDateInput(c.endsAt),
                  isActive: c.isActive,
                };
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium text-fog-100">{c.code}</TableCell>
                    <TableCell>
                      {c.type === "PERCENTAGE" ? `${Number(c.value)}%` : formatCurrency(Number(c.value))}
                    </TableCell>
                    <TableCell className="text-fog-300">
                      {Number(c.minimumOrder) > 0 ? formatCurrency(Number(c.minimumOrder)) : <span className="text-fog-600">—</span>}
                    </TableCell>
                    <TableCell className="text-fog-300">
                      {c.usedCount}
                      {c.usageLimit != null ? ` / ${c.usageLimit}` : ""}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-fog-400">
                      {c.startsAt || c.endsAt ? (
                        <>
                          {c.startsAt ? formatDate(c.startsAt, { hour: undefined, minute: undefined }) : "—"}
                          {" → "}
                          {c.endsAt ? formatDate(c.endsAt, { hour: undefined, minute: undefined }) : "—"}
                        </>
                      ) : (
                        <span className="text-fog-600">No limit</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell className="text-right"><CouponRowActions coupon={formValues} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </GsapReveal>
  );
}

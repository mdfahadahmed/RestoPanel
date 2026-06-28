import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { resolveCustomerQuery } from "@/app/dashboard/customers/query";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "Customer ID",
  "Name",
  "Phone",
  "Email",
  "Address",
  "Status",
  "Tags",
  "Total Orders",
  "Total Spending",
  "Last Order",
  "Joined",
] as const;

function csvCell(value: string): string {
  // Escape quotes and wrap when the value contains a delimiter / newline / quote.
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function htmlCell(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export async function GET(req: NextRequest) {
  const { restaurantId } = await requireTenant();
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const format = sp.format === "xlsx" ? "xlsx" : "csv";

  const { where, orderBy } = await resolveCustomerQuery(restaurantId, sp);

  // Cap export size to keep the request bounded.
  const customers = await prisma.customer.findMany({
    where,
    orderBy,
    take: 5000,
    include: {
      _count: { select: { orders: true } },
      orders: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  // Total paid spending per customer (single grouped query, tenant-scoped).
  const spendRows = await prisma.order.groupBy({
    by: ["customerId"],
    where: { restaurantId, paymentStatus: "PAID", customerId: { in: customers.map((c) => c.id) } },
    _sum: { total: true },
  });
  const spendById = new Map(spendRows.map((r) => [r.customerId, Number(r._sum.total ?? 0)]));

  const rows = customers.map((c) => [
    c.id,
    c.name ?? "",
    c.phone,
    c.email ?? "",
    c.address ?? "",
    c.status,
    c.tags.join("; "),
    String(c._count.orders),
    spendById.get(c.id)?.toFixed(2) ?? "0.00",
    isoDate(c.orders[0]?.createdAt),
    isoDate(c.createdAt),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const lines = [COLUMNS.join(","), ...rows.map((r) => r.map(csvCell).join(","))];
    // Prepend a BOM so Excel reads UTF-8 correctly.
    const body = "﻿" + lines.join("\r\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="customers-${stamp}.csv"`,
      },
    });
  }

  // Excel: an HTML table served as .xls — opens natively in Excel with no deps.
  const thead = `<tr>${COLUMNS.map((c) => `<th>${htmlCell(c)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((cell) => `<td>${htmlCell(cell)}</td>`).join("")}</tr>`).join("");
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8" /></head><body><table border="1">${thead}${tbody}</table></body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${stamp}.xls"`,
    },
  });
}

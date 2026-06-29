import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { ParamTabs } from "@/components/admin/ParamTabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { listPlatformUsers, listAdminUsers } from "@/lib/admin/users";
import { formatDate, formatDateTime, formatNumber } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Owners", value: "OWNER" },
  { label: "Managers", value: "MANAGER" },
  { label: "Staff", value: "STAFF" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const role = (sp.role as "ALL" | "OWNER" | "MANAGER" | "STAFF") ?? "ALL";

  const [{ rows, total, pageCount, perPage }, admins] = await Promise.all([
    listPlatformUsers({ search: sp.q, role, page }),
    listAdminUsers(),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        description={`${formatNumber(total)} restaurant user${total === 1 ? "" : "s"} across the platform.`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Search name or email…" />
        <ParamTabs paramKey="role" options={ROLE_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search or filter." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-fog-300">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "OWNER" ? "violet" : "outline"}>
                      {u.role.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/restaurants/${u.restaurant.id}`}
                      className="text-fog-200 hover:text-violet-300"
                    >
                      {u.restaurant.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-fog-400">{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={pageCount} totalItems={total} pageSize={perPage} />
        </Card>
      )}

      {/* Platform operators */}
      <Card>
        <CardHeader>
          <CardTitle>Platform operators</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-fog-300">{a.email}</TableCell>
                  <TableCell>
                    <Badge variant="gold">{a.role.replace("_", " ").toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-fog-400">
                    {a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.isActive ? "emerald" : "rose"}>
                      {a.isActive ? "active" : "disabled"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

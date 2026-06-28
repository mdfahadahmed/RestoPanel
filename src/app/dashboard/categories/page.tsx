import { Plus, FolderTree } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SearchInput } from "@/components/dashboard/SearchInput";
import { Button } from "@/components/ui/button";
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
import { CategoryFormDialog } from "./CategoryFormDialog";
import { CategoryRowActions } from "./CategoryRowActions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { restaurantId } = await requireTenant();
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const search = q?.trim() ?? "";

  const where = {
    restaurantId,
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [total, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { products: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAny = total > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Organise your menu into categories."
        action={
          <CategoryFormDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4" /> New category
              </Button>
            }
          />
        }
      />

      <div className="flex items-center justify-between gap-3">
        <SearchInput placeholder="Search categories…" />
        {hasAny && (
          <span className="text-xs text-fog-500">
            {total} categor{total === 1 ? "y" : "ies"}
          </span>
        )}
      </div>

      {categories.length === 0 ? (
        search ? (
          <EmptyState
            icon={FolderTree}
            title="No categories match your search"
            description={`Nothing found for “${search}”.`}
          />
        ) : (
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Create your first category to start building your menu."
            action={
              <CategoryFormDialog
                trigger={
                  <Button>
                    <Plus className="h-4 w-4" /> New category
                  </Button>
                }
              />
            }
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-fog-100">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-fog-500">{c.slug}</TableCell>
                  <TableCell>
                    {c.isActive ? (
                      <Badge variant="emerald">Active</Badge>
                    ) : (
                      <Badge variant="outline">Hidden</Badge>
                    )}
                  </TableCell>
                  <TableCell>{c._count.products}</TableCell>
                  <TableCell className="text-fog-400">
                    {formatDate(c.createdAt, { hour: undefined, minute: undefined })}
                  </TableCell>
                  <TableCell className="text-right">
                    <CategoryRowActions
                      category={{ id: c.id, name: c.name, isActive: c.isActive }}
                      productCount={c._count.products}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
          />
        </Card>
      )}
    </div>
  );
}

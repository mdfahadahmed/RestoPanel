import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { ProductForm } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { restaurantId } = await requireTenant();
  const categories = await prisma.category.findMany({
    where: { restaurantId },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New product"
        description="Add an item to your menu."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/products">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <ProductForm categories={categories} />
    </div>
  );
}

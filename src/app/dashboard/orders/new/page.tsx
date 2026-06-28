import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UtensilsCrossed } from "lucide-react";
import type { Extra, Variant } from "@/lib/validations/product";
import { OrderForm, type OrderFormProduct } from "../OrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const { restaurantId } = await requireTenant();

  const [products, customers] = await Promise.all([
    prisma.product.findMany({
      where: { restaurantId, deletedAt: null, status: "ACTIVE", isAvailable: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, discount: true, variants: true, extras: true },
    }),
    prisma.customer.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, name: true, phone: true, email: true },
    }),
  ]);

  const formProducts: OrderFormProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    discount: Number(p.discount),
    variants: (p.variants as unknown as Variant[]) ?? [],
    extras: (p.extras as unknown as Extra[]) ?? [],
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="New order"
        description="Create a walk-in or phone order."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      {formProducts.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No available products"
          description="Add active, available products before creating orders."
          action={
            <Button asChild>
              <Link href="/dashboard/products/new">Add a product</Link>
            </Button>
          }
        />
      ) : (
        <OrderForm products={formProducts} customers={customers} />
      )}
    </div>
  );
}

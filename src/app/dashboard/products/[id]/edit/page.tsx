import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { ProductForm, type ProductFormInitial } from "../../ProductForm";
import type { Extra, ProductImage, Variant } from "@/lib/validations/product";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { restaurantId } = await requireTenant();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, restaurantId, deletedAt: null },
    }),
    prisma.category.findMany({
      where: { restaurantId },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const initial: ProductFormInitial = {
    id: product.id,
    name: product.name,
    description: product.description ?? "",
    shortDescription: product.shortDescription ?? "",
    categoryId: product.categoryId,
    images: (product.images as unknown as ProductImage[]) ?? [],
    price: Number(product.price),
    comparePrice: product.comparePrice != null ? Number(product.comparePrice) : null,
    costPrice: product.costPrice != null ? Number(product.costPrice) : null,
    discount: Number(product.discount),
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    calories: product.calories,
    stockQuantity: product.stockQuantity,
    stockStatus: product.stockStatus,
    status: product.status,
    isAvailable: product.isAvailable,
    featured: product.featured,
    bestSeller: product.bestSeller,
    prepTimeMins: product.prepTimeMins,
    ingredients: product.ingredients,
    extras: (product.extras as unknown as Extra[]) ?? [],
    variants: (product.variants as unknown as Variant[]) ?? [],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit product"
        description={product.name}
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/products">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <ProductForm categories={categories} initial={initial} />
    </div>
  );
}

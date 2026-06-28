import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { CartView } from "@/components/store/cart/CartView";

export const dynamic = "force-dynamic";

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight text-fog-50">Your cart</h1>
      <CartView slug={slug} />
    </div>
  );
}

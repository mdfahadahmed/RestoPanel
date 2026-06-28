import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { CheckoutForm, type CheckoutSettings } from "@/components/store/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const settings: CheckoutSettings = {
    taxRate: Number(restaurant.taxRate),
    deliveryFee: Number(restaurant.deliveryFee),
    deliveryEnabled: restaurant.deliveryEnabled,
    pickupEnabled: restaurant.pickupEnabled,
    dineInEnabled: restaurant.dineInEnabled,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight text-fog-50">Checkout</h1>
      <CheckoutForm slug={slug} settings={settings} />
    </div>
  );
}

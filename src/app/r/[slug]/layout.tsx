import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { CartProvider } from "@/components/store/cart/CartProvider";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { TableIndicator } from "@/components/store/TableIndicator";
import { Toaster } from "@/components/ui/sonner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return { title: "Restaurant not found" };
  const title = restaurant.metaTitle || `${restaurant.name} — Order online`;
  const description =
    restaurant.metaDescription ||
    restaurant.shortDescription ||
    restaurant.description ||
    `Order online from ${restaurant.name} for delivery, takeaway or dine in.`;
  const ogImage = restaurant.ogImageUrl || restaurant.coverImageUrl;
  return {
    title,
    description,
    openGraph: {
      title: restaurant.metaTitle || restaurant.name,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function StoreLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const closure = (restaurant.temporaryClosure as { enabled?: boolean; message?: string } | null) ?? null;

  return (
    <CartProvider slug={slug} currency={restaurant.currency}>
      <div className="flex min-h-screen flex-col bg-ink-950 text-fog-200">
        <StoreHeader slug={slug} name={restaurant.name} logoUrl={restaurant.logoUrl} />
        <Suspense fallback={null}>
          <TableIndicator />
        </Suspense>
        {closure?.enabled && (
          <div className="bg-amber-500/15 px-4 py-2.5 text-center text-sm text-amber-200">
            {closure.message || "We're temporarily closed for online orders. Please check back soon."}
          </div>
        )}
        <main className="flex-1">{children}</main>
        <StoreFooter
          slug={slug}
          name={restaurant.name}
          phone={restaurant.phone}
          email={restaurant.email}
          address={restaurant.address}
          social={{
            facebook: restaurant.facebookUrl,
            instagram: restaurant.instagramUrl,
            tiktok: restaurant.tiktokUrl,
            twitter: restaurant.twitterUrl,
          }}
        />
      </div>
      <Toaster />
    </CartProvider>
  );
}

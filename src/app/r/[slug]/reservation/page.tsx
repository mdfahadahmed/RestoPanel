import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { ReservationForm } from "@/components/store/ReservationForm";

export const dynamic = "force-dynamic";

export default async function ReservationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <div className="mb-8 text-center">
        <CalendarDays className="mx-auto h-10 w-10 text-gold-300" />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fog-50">Book a table</h1>
        <p className="mt-2 text-fog-400">Reserve your spot at {restaurant.name}.</p>
      </div>
      <ReservationForm slug={slug} />
    </div>
  );
}

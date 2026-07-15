import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageSearch, UserRound } from "lucide-react";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { getCustomerSession } from "@/lib/account/context";
import { TrackOrderLookup } from "@/components/store/TrackOrderLookup";

export const dynamic = "force-dynamic";

export default async function TrackOrderLookupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const session = await getCustomerSession();

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-ink-900">
          <PackageSearch className="h-6 w-6 text-gold-300" />
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-fog-50">
          Track your order
        </h1>
        <p className="mt-2 text-fog-400">
          Enter your order number to see live status and progress from{" "}
          {restaurant.name}.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-ink-900/50 p-6">
        <TrackOrderLookup slug={slug} />
        <p className="mt-4 text-xs text-fog-500">
          Your order number is on your confirmation screen and receipt.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-ink-900/40 p-5 text-sm">
        <div className="flex items-center gap-2 text-fog-200">
          <UserRound className="h-4 w-4 text-fog-500" />
          {session ? (
            <span>
              Signed in — see all your live orders in{" "}
              <Link href="/account/track" className="font-medium text-gold-300 hover:text-gold-200">
                your account
              </Link>
              .
            </span>
          ) : (
            <span>
              Have an account?{" "}
              <Link
                href={`/account/login?next=${encodeURIComponent("/account/track")}`}
                className="font-medium text-gold-300 hover:text-gold-200"
              >
                Sign in
              </Link>{" "}
              to track every order in one place.
            </span>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href={`/r/${slug}/menu`} className="text-sm text-fog-400 hover:text-fog-100">
          ← Back to menu
        </Link>
      </div>
    </div>
  );
}

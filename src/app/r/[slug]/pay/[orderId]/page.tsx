import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getRestaurantBySlug } from "@/lib/storefront/data";
import { getStripeConfig } from "@/lib/billing/stripe";
import { startOrderPayment } from "@/lib/payments/service";
import { PaymentPanel } from "@/components/store/PaymentPanel";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    select: { id: true, orderNumber: true, total: true, paymentStatus: true },
  });
  if (!order) notFound();

  const trackHref = `/r/${slug}/track/${order.orderNumber}`;
  // Already settled — nothing to pay.
  if (order.paymentStatus === "PAID") redirect(trackHref);

  const started = await startOrderPayment(order.id);
  const publishableKey = (await getStripeConfig())?.publishableKey ?? null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-300">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-fog-50">
          Secure payment
        </h1>
        <p className="mt-1 text-sm text-fog-400">Order #{order.orderNumber}</p>
      </div>

      <div className="mt-8">
        {started.ok ? (
          <PaymentPanel
            slug={slug}
            orderId={order.id}
            orderNumber={order.orderNumber}
            total={Number(order.total)}
            currency={restaurant.currency}
            provider={started.data!.provider}
            clientSecret={started.data!.clientSecret}
            publishableKey={publishableKey}
            trackHref={trackHref}
          />
        ) : (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-6 text-center">
            <p className="text-sm text-fog-200">{started.error}</p>
            <Link
              href={trackHref}
              className="mt-4 inline-block rounded-full border border-line bg-ink-900 px-5 py-2.5 text-sm text-fog-200 transition hover:bg-ink-800"
            >
              View order status
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

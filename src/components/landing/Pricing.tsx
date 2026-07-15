import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { PricingCards } from "./PricingCards";
import { getPublicPlans } from "@/lib/marketing/content";

export async function Pricing() {
  const plans = await getPublicPlans();

  return (
    <section id="pricing" className="relative px-4 py-24 sm:px-6">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple plans that grow with you"
        description="Start free. Upgrade when you're ready. No per-order commissions, ever."
      />

      <PricingCards plans={plans} />

      <p className="mx-auto mt-8 text-center text-sm text-fog-500">
        All plans include hard tenant isolation, SSL and free updates. See what&apos;s
        new on the{" "}
        <Link href="/changelog" className="font-medium text-violet-300 hover:text-violet-200">
          changelog
        </Link>
        .
      </p>
    </section>
  );
}

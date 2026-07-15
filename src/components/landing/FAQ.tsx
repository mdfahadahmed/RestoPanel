import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { FaqAccordion } from "./FaqAccordion";
import { getLandingFaqs } from "@/lib/marketing/content";

export async function FAQ() {
  const faqs = await getLandingFaqs();

  return (
    <section id="faq" className="relative px-4 py-24 sm:px-6">
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />

      <FaqAccordion faqs={faqs} />

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-fog-500">
        Still curious?{" "}
        <Link href="/#contact" className="font-medium text-violet-300 hover:text-violet-200">
          Talk to us
        </Link>{" "}
        or read the{" "}
        <Link href="/docs" className="font-medium text-violet-300 hover:text-violet-200">
          API docs
        </Link>
        .
      </p>
    </section>
  );
}

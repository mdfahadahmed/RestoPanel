"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionHeading } from "./SectionHeading";

const FAQS = [
  {
    q: "How quickly can I get my restaurant online?",
    a: "Register with your details and RestoPanel instantly creates your dashboard, a unique restaurant ID and your customer ordering site. Most owners are taking test orders within minutes.",
  },
  {
    q: "Is my data separate from other restaurants?",
    a: "Yes. RestoPanel is multi-tenant by design — every record is scoped to your restaurant and no other account can ever access your menus, orders or customers.",
  },
  {
    q: "Do you charge commission on orders?",
    a: "Never. You pay a simple flat monthly plan and keep 100% of every order. No per-transaction fees.",
  },
  {
    q: "Can customers track their orders?",
    a: "Customers receive SMS updates at each stage and can follow a live status timeline with an estimated time — from confirmed to delivered.",
  },
  {
    q: "Which countries do you support?",
    a: "RestoPanel is optimised for restaurants in the UK, US and Canada, with currency, phone and SMS support tailored to each region.",
  },
  {
    q: "Can I manage staff and roles?",
    a: "On Growth and Pro plans you can invite staff with role-based access, so managers and team members only see what they need.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative px-4 py-24 sm:px-6">
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />

      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={item.q}
              className="overflow-hidden rounded-2xl border border-line bg-ink-900/40"
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-[15px] font-medium">{item.q}</span>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-fog-300 transition-transform ${
                    isOpen ? "rotate-45" : ""
                  }`}
                >
                  +
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-fog-400">
                      {item.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

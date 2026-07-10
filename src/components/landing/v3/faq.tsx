"use client";

/**
 * Landing v3 — FAQ accordion (Sprint 055).
 *
 * Ten plain-language answers rendered as an accessible accordion (buttons +
 * aria-expanded, animated height). Content comes from faq-data.ts — the same
 * source the FAQPage structured data uses.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { FAQ_ITEMS } from "@/components/landing/v3/faq-data";
import { EASE, Reveal, SectionHeading } from "@/components/landing/v3/motion";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto max-w-3xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="Questions"
        title="Everything leaders [ask us first.]"
      />

      <Reveal className="mt-12">
        <div className="divide-y divide-neutral-200 rounded-3xl border border-neutral-200 bg-white shadow-taurus-sm">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors duration-200 hover:bg-neutral-50/70 sm:px-7"
                >
                  <span className="text-[15px] font-semibold text-neutral-950">{item.q}</span>
                  <motion.span
                    aria-hidden
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-lg font-light text-neutral-500"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-[14px] leading-relaxed text-neutral-500 sm:px-7">{item.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

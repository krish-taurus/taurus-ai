"use client";

/**
 * Knowledge Vault section (Premium Landing v2).
 *
 * Source chips flow down into a secure vault, then the vault connects to a
 * specific AI Employee — knowledge in, grounded answers out.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Reveal, SectionHeading } from "@/components/landing/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

const SOURCES = [
  "Policies",
  "FAQs",
  "Sales docs",
  "Product guides",
  "SOPs",
  "Website content",
  "Internal notes",
];

export function KnowledgeVaultAnimation() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Knowledge Vault"
          title="Give every AI Employee approved company knowledge."
          description="Control which knowledge each AI Employee can use. Keep answers grounded in approved company information."
        />

        <Reveal className="mt-16">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#080808] p-8 sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_260px_at_50%_100%,rgba(255,255,255,0.05),transparent_70%)]"
            />

            {/* Source chips raining in. */}
            <div className="relative flex flex-wrap justify-center gap-2.5">
              {SOURCES.map((source, index) => (
                <motion.span
                  key={source}
                  initial={{ opacity: 0, y: -24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: 0.1 + index * 0.1, ease: EASE }}
                  className="rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs text-taurus-sub"
                >
                  {source}
                </motion.span>
              ))}
            </div>

            {/* Flow lines into the vault. */}
            <div aria-hidden className="relative mx-auto mt-4 flex justify-center">
              <svg viewBox="0 0 240 56" className="h-14 w-60">
                {[30, 90, 150, 210].map((x) => (
                  <path
                    key={x}
                    d={`M ${x} 0 C ${x} 32, 120 24, 120 56`}
                    fill="none"
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth="1"
                    className={reduceMotion ? undefined : "landing-dash-slow"}
                  />
                ))}
              </svg>
            </div>

            {/* The vault. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
              className="relative mx-auto w-fit rounded-2xl border border-white/20 bg-white/[0.06] px-10 py-5 text-center shadow-[0_0_60px_rgba(255,255,255,0.06)]"
            >
              <div
                aria-hidden
                className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/25"
              >
                <span className="h-2.5 w-2.5 rounded-sm border border-white/60" />
              </div>
              <p className="text-sm font-semibold text-taurus-text">Knowledge Vault</p>
              <p className="mt-0.5 text-[11px] text-taurus-faint">Approved · Organization-scoped</p>
            </motion.div>

            {/* Vault → Employee assignment. */}
            <div aria-hidden className="relative mx-auto mt-2 flex justify-center">
              <svg viewBox="0 0 8 44" className="h-11 w-2">
                <path
                  d="M 4 0 L 4 44"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1.5"
                  className={reduceMotion ? undefined : "landing-dash"}
                />
              </svg>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.7, ease: EASE }}
              className="relative mx-auto flex w-fit items-center gap-3 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-xs font-semibold text-taurus-text">
                A
              </span>
              <span className="text-left">
                <span className="block text-sm font-semibold text-taurus-text">
                  Atlas — AI Support
                </span>
                <span className="block text-[11px] text-taurus-faint">
                  14 sources assigned · answers stay grounded
                </span>
              </span>
            </motion.div>
          </div>
        </Reveal>

        <Reveal delay={0.15} className="mx-auto mt-10 max-w-xl text-center">
          <p className="text-sm text-taurus-faint">
            Your company knowledge, safely assigned to every AI Employee.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

"use client";

/**
 * Final CTA (Premium Landing v2).
 *
 * An employee card is "hired" and its channels light up — then the closing ask.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/landing/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;
const CTA_CHANNELS = ["Website", "Chat", "Email", "Voice-ready"];

export function FinalCta() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden py-28 sm:py-36" id="pricing">
      {/* Closing glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(700px_320px_at_50%_100%,rgba(255,255,255,0.07),transparent_70%)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-taurus-text sm:text-5xl">
              Hire your first AI Employee.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-taurus-sub sm:text-lg">
              Start with one role. Add your knowledge. Define the DNA. Deploy across your channels.
            </p>
          </Reveal>

          {/* The hire moment. */}
          <Reveal delay={0.15} className="mt-12">
            <div className="mx-auto w-fit">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: EASE }}
                className="rounded-2xl border border-white/20 bg-white/[0.06] px-8 py-5 shadow-[0_0_70px_rgba(255,255,255,0.07)] backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/[0.08] text-sm font-semibold text-taurus-text">
                    M
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-semibold text-taurus-text">
                      Maya — AI Sales Assistant
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-taurus-faint">
                      <span
                        aria-hidden
                        className={`h-1 w-1 rounded-full bg-white ${reduceMotion ? "" : "landing-pulse"}`}
                      />
                      Hired · DNA published · Knowledge assigned
                    </span>
                  </span>
                </div>
              </motion.div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {CTA_CHANNELS.map((channel, index) => (
                  <motion.span
                    key={channel}
                    initial={{ opacity: 0.3, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.45, delay: 0.45 + index * 0.14, ease: EASE }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] text-taurus-sub"
                  >
                    <span aria-hidden className="h-1 w-1 rounded-full bg-white" />
                    {channel}
                  </motion.span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.25} className="mt-12">
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group relative w-full rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-[#050505] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] sm:w-auto"
              >
                Get started
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 shadow-[0_0_50px_rgba(255,255,255,0.35)] transition-opacity duration-300 group-hover:opacity-100"
                />
              </Link>
              <Link
                href="/login"
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-taurus-text transition-colors duration-200 hover:border-white/30 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-xs text-taurus-faint">
              Pricing announced at launch — early access starts free.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

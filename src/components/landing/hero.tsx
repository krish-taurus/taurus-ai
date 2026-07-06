"use client";

/**
 * Hero (Premium Landing v2).
 *
 * Cinematic entrance: badge, oversized headline with a silver shimmer accent,
 * enterprise subheadline, dual CTAs, and the living workforce network beneath.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { HeroWorkforceAnimation } from "@/components/landing/hero-workforce-animation";

const EASE = [0.16, 1, 0.3, 1] as const;

function item(delay: number) {
  return {
    initial: { opacity: 0, y: 26 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, delay, ease: EASE },
  };
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-10 pt-32 sm:pb-16 sm:pt-40" id="top">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.p
            {...item(0.05)}
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium tracking-wide text-taurus-sub backdrop-blur"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
            Workforce OS — not another chatbot
          </motion.p>

          <motion.h1
            {...item(0.15)}
            className="text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-taurus-text sm:text-6xl md:text-7xl"
          >
            The operating system for{" "}
            <span className="landing-shimmer bg-[linear-gradient(110deg,#f5f5f5_35%,#8a8a8a_50%,#f5f5f5_65%)] bg-clip-text text-transparent">
              AI Employees.
            </span>
          </motion.h1>

          <motion.p
            {...item(0.28)}
            className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-taurus-sub sm:text-lg"
          >
            Hire, train, deploy, and manage AI Employees that understand your company, follow your
            rules, and work across every customer channel.
          </motion.p>

          <motion.div
            {...item(0.4)}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link
              href="/signup"
              className="group relative w-full rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-[#050505] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] sm:w-auto"
            >
              Hire your first AI Employee
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl opacity-0 shadow-[0_0_50px_rgba(255,255,255,0.35)] transition-opacity duration-300 group-hover:opacity-100"
              />
            </Link>
            <a
              href="#how-it-works"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-taurus-text backdrop-blur transition-colors duration-200 hover:border-white/30 hover:bg-white/[0.07] sm:w-auto"
            >
              Watch how Taurus works
            </a>
          </motion.div>
        </div>

        {/* The living system. */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: EASE }}
          className="relative mt-14 sm:mt-20"
        >
          <HeroWorkforceAnimation />
          {/* Fade the diagram into the page bottom to avoid a hard edge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -bottom-2 h-24 bg-[linear-gradient(to_top,#030303,transparent)]"
          />
        </motion.div>

        {/* Above-the-fold positioning strip. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9, ease: EASE }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium uppercase tracking-[0.2em] text-taurus-faint"
        >
          <span>Employee DNA</span>
          <span aria-hidden className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
          <span>Knowledge Vault</span>
          <span aria-hidden className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
          <span>Model Hub</span>
          <span aria-hidden className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
          <span>Channels</span>
        </motion.div>
      </div>
    </section>
  );
}

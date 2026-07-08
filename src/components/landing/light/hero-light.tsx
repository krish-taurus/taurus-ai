"use client";

/**
 * Light hero (Sprint 020).
 *
 * Oversized rise-in headline "Hire AI employees. Not another chatbot." on a white
 * surface, a supporting line, dual CTAs to the real auth routes, and a large
 * editorial illustration of a hired AI Employee working across channels. The
 * headline rises word-by-word; everything else fades up. Reduced motion is
 * honored globally by the shell's MotionConfig.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { EmployeeHeroIllustration } from "@/components/landing/light/illustrations";

const EASE = [0.16, 1, 0.3, 1] as const;

const HEADLINE_LINE_ONE = ["Hire", "AI", "employees."];
const HEADLINE_LINE_TWO = ["Not", "another", "chatbot."];

function RiseWords({ words, start, muted }: { words: string[]; start: number; muted?: boolean }) {
  return (
    <span className="block overflow-hidden">
      <span className="flex flex-wrap gap-x-[0.28em]">
        {words.map((word, index) => (
          <motion.span
            key={`${word}-${index}`}
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.85, delay: start + index * 0.08, ease: EASE }}
            className={`inline-block ${muted ? "text-neutral-400" : "text-neutral-900"}`}
          >
            {word}
          </motion.span>
        ))}
      </span>
    </span>
  );
}

export function HeroLight() {
  return (
    <section className="relative overflow-hidden pb-16 pt-32 sm:pb-24 sm:pt-40" id="top">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="text-center lg:text-left">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-xs font-medium tracking-wide text-neutral-500 lg:mx-0"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
            The operating system for AI Employees
          </motion.p>

          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl md:text-7xl lg:text-[5rem]">
            <RiseWords words={HEADLINE_LINE_ONE} start={0.15} />
            <RiseWords words={HEADLINE_LINE_TWO} start={0.4} muted />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
            className="mx-auto mt-8 max-w-xl text-pretty text-lg leading-relaxed text-neutral-600 sm:text-xl lg:mx-0"
          >
            Hire, train, and deploy AI Employees that understand your company, follow your rules, and
            work across every customer channel — not a scripted widget bolted onto your website.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.85, ease: EASE }}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
          >
            <Link
              href="/signup"
              className="group relative w-full rounded-xl bg-neutral-900 px-7 py-4 text-base font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] sm:w-auto"
            >
              Hire your first AI Employee
            </Link>
            <a
              href="#how-it-works"
              className="w-full rounded-xl border border-neutral-300 bg-white px-7 py-4 text-base font-semibold text-neutral-900 transition-colors duration-200 hover:border-neutral-900 sm:w-auto"
            >
              See how it works
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.05, ease: EASE }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 lg:justify-start"
          >
            <span>Employee DNA</span>
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-neutral-300 sm:block" />
            <span>Knowledge Vault</span>
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-neutral-300 sm:block" />
            <span>Model Hub</span>
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-neutral-300 sm:block" />
            <span>Every channel</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: EASE }}
          className="relative"
        >
          <EmployeeHeroIllustration />
        </motion.div>
      </div>
    </section>
  );
}

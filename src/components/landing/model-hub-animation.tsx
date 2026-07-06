"use client";

/**
 * Model Hub section (Premium Landing v2).
 *
 * A router visual: incoming jobs on the left are routed to the right brain on
 * the right — Economy, Balanced, Premium, Privacy First — cycling on a timer
 * (static under reduced motion).
 */

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Reveal, SectionHeading } from "@/components/landing/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

const ROUTES: { job: string; mode: string; note: string }[] = [
  { job: "Simple question", mode: "Economy", note: "Fast and inexpensive" },
  { job: "Support answer", mode: "Balanced", note: "Quality and speed" },
  { job: "Complex reasoning", mode: "Premium", note: "Highest quality" },
  { job: "Private workload", mode: "Privacy First", note: "Open models, private" },
];

const MODES = ["Economy", "Balanced", "Premium", "Privacy First"];

export function ModelHubAnimation() {
  const [step, setStep] = useState(1);
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-25% 0px -25% 0px" });

  useEffect(() => {
    if (reduceMotion || !inView) return;
    const timer = window.setInterval(() => setStep((v) => (v + 1) % ROUTES.length), 2800);
    return () => window.clearInterval(timer);
  }, [reduceMotion, inView]);

  const current = ROUTES[step];

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Model Hub"
          title="Choose the right brain for every job."
          description="Taurus is designed to work across multiple AI model providers so teams can balance quality, cost, speed, and privacy."
        />

        <Reveal className="mt-16">
          <div
            ref={ref}
            className="relative mx-auto grid max-w-4xl grid-cols-1 items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-[#080808] p-8 sm:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,4fr)] sm:p-10"
          >
            {/* Incoming job */}
            <div className="text-center sm:text-left">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-taurus-faint">
                Incoming work
              </p>
              <div className="relative h-16">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current.job}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="inline-flex rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-medium text-taurus-text"
                  >
                    {current.job}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Router */}
            <div className="flex flex-col items-center gap-2">
              <svg aria-hidden viewBox="0 0 120 8" className="hidden h-2 w-full sm:block">
                <path
                  d="M 0 4 L 120 4"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                  className={reduceMotion ? undefined : "landing-dash"}
                />
              </svg>
              <div className="rounded-xl border border-white/20 bg-white/[0.07] px-5 py-3 text-center shadow-[0_0_44px_rgba(255,255,255,0.06)]">
                <p className="text-sm font-semibold text-taurus-text">Model Hub</p>
                <p className="text-[10px] text-taurus-faint">routing</p>
              </div>
              <svg aria-hidden viewBox="0 0 120 8" className="hidden h-2 w-full sm:block">
                <path
                  d="M 0 4 L 120 4"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                  className={reduceMotion ? undefined : "landing-dash"}
                />
              </svg>
            </div>

            {/* Brains */}
            <div className="space-y-2">
              {MODES.map((mode) => {
                const active = mode === current.mode;
                return (
                  <motion.div
                    key={mode}
                    animate={{
                      borderColor: active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)",
                      backgroundColor: active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
                    }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center justify-between rounded-xl border px-4 py-2.5"
                  >
                    <span
                      className={`text-sm font-medium ${active ? "text-taurus-text" : "text-taurus-faint"}`}
                    >
                      {mode}
                    </span>
                    {active ? (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-1.5 w-1.5 rounded-full bg-white"
                        aria-hidden
                      />
                    ) : null}
                  </motion.div>
                );
              })}
              <AnimatePresence mode="wait">
                <motion.p
                  key={current.note}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="pt-1 text-right text-[11px] text-taurus-faint"
                >
                  {current.note}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

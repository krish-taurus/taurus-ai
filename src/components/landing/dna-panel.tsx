"use client";

/**
 * Employee DNA panel (Premium Landing v2).
 *
 * Split layout: employee profile on the left, DNA sections filling in on the
 * right with an animated completion score counting to 100% once in view.
 */

import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Reveal, SectionHeading } from "@/components/landing/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

const DNA_SECTIONS: { label: string; detail: string }[] = [
  { label: "Mission", detail: "Turn every inbound question into a qualified conversation." },
  { label: "Responsibilities", detail: "Answer product questions, qualify leads, book demos." },
  { label: "Communication Style", detail: "Warm, concise, always on-brand." },
  { label: "Boundaries", detail: "Never discuss unreleased pricing or legal terms." },
  { label: "Escalation Rules", detail: "Hand off to a human when judgment is required." },
];

function CompletionScore() {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setValue(100);
      return;
    }
    const controls = animate(0, 100, {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduceMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {value}%
    </span>
  );
}

export function DnaPanel() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Employee DNA"
          title="Replace prompt engineering with Employee DNA."
          description="Employee DNA defines how every AI Employee behaves: its mission, responsibilities, communication style, boundaries, escalation rules, and company context."
        />

        <Reveal className="mt-16">
          <div className="mx-auto grid max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-white/10 bg-[#080808] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {/* Employee profile */}
            <div className="relative border-b border-white/10 p-7 md:border-b-0 md:border-r">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(280px_200px_at_30%_0%,rgba(255,255,255,0.05),transparent_70%)]"
              />
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.07] text-lg font-semibold text-taurus-text">
                  M
                </div>
                <h3 className="mt-4 text-lg font-semibold text-taurus-text">Maya</h3>
                <p className="text-sm text-taurus-faint">AI Sales Assistant · Revenue</p>
                <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-taurus-faint">
                    DNA completion
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-taurus-text">
                    <CompletionScore />
                  </p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ duration: 2.2, ease: EASE }}
                      className="h-full origin-left bg-white/70"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* DNA sections filling in */}
            <div className="space-y-2.5 p-7">
              {DNA_SECTIONS.map((section, index) => (
                <motion.div
                  key={section.label}
                  initial={{ opacity: 0, x: 22 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.6, delay: 0.15 + index * 0.14, ease: EASE }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-taurus-text">{section.label}</p>
                    <motion.span
                      initial={{ opacity: 0, scale: 0.4 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ delay: 0.5 + index * 0.14, duration: 0.35, ease: EASE }}
                      aria-hidden
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/25 text-[10px] text-taurus-text"
                    >
                      ✓
                    </motion.span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-taurus-faint">{section.detail}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

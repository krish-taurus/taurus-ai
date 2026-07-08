"use client";

/**
 * Performance Review trust section (Sprint 020).
 *
 * The "you can trust the work" moment: an animated scorecard whose criteria bars
 * fill and overall score counts up as it scrolls into view. Establishes that a
 * Taurus AI Employee is measured and improves — not a black box. Internal words
 * (eval / rubric / grader) never appear.
 */

import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeadingLight } from "@/components/landing/light/section-heading-light";
import { IconShield } from "@/components/landing/light/illustrations";

const EASE = [0.16, 1, 0.3, 1] as const;

const CRITERIA = [
  { label: "Answers from your knowledge", score: 96 },
  { label: "Stays within boundaries", score: 92 },
  { label: "Escalates when it should", score: 89 },
  { label: "On-brand communication", score: 94 },
];

const OVERALL = 93;

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const value = useMotionValue(0);
  const rounded = useTransform(value, (v) => Math.round(v).toString());

  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration: 1.1, ease: EASE });
    return () => controls.stop();
  }, [inView, to, value]);

  return (
    <span ref={ref}>
      <motion.span>{rounded}</motion.span>
    </span>
  );
}

export function PerformanceSection() {
  return (
    <section className="relative py-24 sm:py-32" id="performance">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <SectionHeadingLight
            eyebrow="Performance Review"
            title="Work you can trust — and watch improve."
            description="Score an AI Employee against real situations, see exactly where it excels or slips, and watch quality climb as you refine the DNA. Measured, not a black box."
            align="left"
          />
          <Reveal className="mt-8 flex items-center gap-3 text-neutral-600" delay={0.1}>
            <IconShield className="h-6 w-6 text-neutral-900" />
            <span className="text-base">
              Governance from day one — every Employee has boundaries, escalation rules, and an audit
              trail.
            </span>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Scorecard</p>
                <p className="text-lg font-semibold text-neutral-900">Maya — AI Sales Assistant</p>
              </div>
              <div className="text-right">
                <p className="text-5xl font-semibold tracking-tight text-neutral-900">
                  <CountUp to={OVERALL} />
                </p>
                <p className="text-xs uppercase tracking-wide text-neutral-400">Overall</p>
              </div>
            </div>

            <div className="mt-8 space-y-5">
              {CRITERIA.map((criterion, index) => (
                <div key={criterion.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">{criterion.label}</span>
                    <span className="font-semibold text-neutral-900">{criterion.score}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <motion.div
                      className="h-full rounded-full bg-neutral-900"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${criterion.score}%` }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ duration: 1, delay: 0.15 + index * 0.12, ease: EASE }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <span aria-hidden className="text-neutral-900">↑</span>
              <p className="text-sm text-neutral-600">
                Up 11 points since the last DNA revision.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

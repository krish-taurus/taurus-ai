"use client";

/**
 * Landing v3 — performance & outcomes (Sprint 055).
 *
 * "Measure work, not just conversations": a live-feeling scorecard where the
 * numbers count up, the week's bars grow in, and the review reads like a real
 * performance review — because in the product, it is one (scheduled Performance
 * Reviews score groundedness, boundaries and outcomes).
 */

import { motion } from "framer-motion";
import { CountUp, EASE, Reveal, SectionHeading, SecondaryCta } from "@/components/landing/v3/motion";

const METRICS = [
  { v: 1284, suffix: "", k: "Tasks completed" },
  { v: 6, suffix: "s", k: "Median response time" },
  { v: 97, suffix: "%", k: "Workflow success rate" },
  { v: 4.2, suffix: "%", k: "Escalated to humans", decimals: 1 },
  { v: 212, suffix: "", k: "Meetings scheduled" },
  { v: 118, suffix: "h", k: "Human hours saved" },
];

const WEEK = [42, 58, 47, 66, 74, 61, 82];

const REVIEW_ROWS = [
  { k: "Answers from your knowledge", score: "Strong" },
  { k: "Stays within boundaries", score: "Strong" },
  { k: "Escalates at the right moment", score: "Strong" },
  { k: "Tone matches the DNA", score: "Improving" },
];

export function Performance() {
  return (
    <section id="performance" className="relative scroll-mt-24 bg-neutral-50/60 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Performance & outcomes"
          title="Measure work, not just [conversations.]"
          description="Taurus AI Employees are designed around responsibilities and outcomes — reviewed on a schedule, scored on evidence, improved with feedback."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Scorecard */}
          <Reveal>
            <div className="h-full rounded-3xl border border-neutral-200 bg-white p-6 shadow-taurus sm:p-8">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-neutral-400">
                  Workforce scorecard · this month
                </p>
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="landing-blink h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden />
                  Updating live
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {METRICS.map((m) => (
                  <div key={m.k} className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-4 py-4">
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-950 sm:text-3xl">
                      <CountUp to={m.v} suffix={m.suffix} decimals={m.decimals ?? 0} />
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-400">{m.k}</p>
                  </div>
                ))}
              </div>

              {/* The week's work, growing in */}
              <div className="mt-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-neutral-400">
                  Tasks completed · last 7 days
                </p>
                <div className="mt-3 flex h-28 items-end gap-2.5">
                  {WEEK.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.8, ease: EASE, delay: i * 0.07 }}
                      className={`flex-1 rounded-t-lg ${i === WEEK.length - 1 ? "bg-neutral-950" : "bg-neutral-200"}`}
                      aria-hidden
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-neutral-400" aria-hidden>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <span key={d} className="flex-1 text-center">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Performance review card */}
          <Reveal delay={0.12}>
            <div className="flex h-full flex-col rounded-3xl bg-neutral-950 p-6 text-white shadow-[0_32px_80px_-32px_rgba(0,0,0,0.5)] sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-neutral-500">
                Performance Review · Nova
              </p>
              <p className="mt-2 text-sm text-neutral-400">Scheduled · runs every Sunday</p>
              <div className="mt-6 flex-1 space-y-3">
                {REVIEW_ROWS.map((r, i) => (
                  <motion.div
                    key={r.k}
                    initial={{ opacity: 0, x: 18 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.1 }}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3.5"
                  >
                    <span className="text-[13px] text-neutral-200">{r.k}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        r.score === "Strong" ? "bg-white text-neutral-950" : "border border-neutral-600 text-neutral-300"
                      }`}
                    >
                      {r.score}
                    </span>
                  </motion.div>
                ))}
              </div>
              <p className="mt-6 text-[12px] leading-relaxed text-neutral-500">
                Reviews score real transcripts against the Employee DNA — groundedness, boundaries,
                escalation judgement and tone — and feed improvements back into the employee.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-12 text-center">
          <SecondaryCta href="/signup">See how performance is measured</SecondaryCta>
        </Reveal>

        <Reveal className="mt-6 text-center">
          <p className="text-[12px] text-neutral-400">Numbers shown are illustrative of the dashboard, not customer claims.</p>
        </Reveal>
      </div>
    </section>
  );
}

"use client";

/**
 * Landing v3 — Model Hub (Sprint 055).
 *
 * Multi-model intelligence as a routing board: employees on the left, provider
 * slots on the right, animated routes between them that periodically re-route —
 * the visual proof that you can switch providers without rebuilding the
 * employee. Brand-light on purpose: the message is freedom and control.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE, Reveal, RevealGroup, RevealItem, SectionHeading, SecondaryCta } from "@/components/landing/v3/motion";

const POINTS = [
  "Taurus-managed models by default — zero setup",
  "Bring your own provider API keys, encrypted at rest",
  "Assign a different model to every employee",
  "Balance cost, quality and speed per role",
  "Switch providers without rebuilding the employee",
  "Usage tracked to the interaction, per organisation",
];

const EMPLOYEE_ROWS = ["Nova · Sales", "Juno · Support", "Atlas · Analysis"];
const PROVIDERS = ["Provider A", "Provider B", "Provider C", "Your keys"];

/** Routing assignments cycle to show live re-routing. */
const ASSIGNMENTS = [
  [0, 1, 2],
  [1, 1, 3],
  [0, 3, 2],
  [2, 0, 3],
];

export function ModelHub() {
  const [round, setRound] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRound((r) => (r + 1) % ASSIGNMENTS.length), 3400);
    return () => clearInterval(id);
  }, []);
  const routes = ASSIGNMENTS[round];

  const yFor = (i: number, count: number) => 40 + (i * 200) / (count - 1);

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="Model Hub"
        title="Choose the right intelligence for [every job.]"
        description="One workforce, many minds. Route each AI Employee to the model that fits its work — and change your mind at any time."
      />

      <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Routing board */}
        <Reveal>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-taurus sm:p-7">
            <div className="flex items-center justify-between pb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-neutral-400">Model routing</p>
              <AnimatePresence mode="wait">
                <motion.span
                  key={round}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-medium text-neutral-500"
                >
                  Re-routed · no rebuild needed
                </motion.span>
              </AnimatePresence>
            </div>
            <svg viewBox="0 0 520 280" className="h-auto w-full" role="img" aria-label="AI Employees routed to interchangeable model providers">
              {/* Employee nodes */}
              {EMPLOYEE_ROWS.map((e, i) => (
                <g key={e} transform={`translate(10 ${yFor(i, 3)})`}>
                  <rect width={150} height={40} rx={12} className="fill-neutral-950" />
                  <text x={75} y={24} textAnchor="middle" className="fill-white text-[12px] font-medium">
                    {e}
                  </text>
                </g>
              ))}
              {/* Provider nodes */}
              {PROVIDERS.map((p, i) => (
                <g key={p} transform={`translate(370 ${yFor(i, 4) - 8})`}>
                  <rect width={140} height={36} rx={12} className={i === 3 ? "fill-white stroke-neutral-900" : "fill-neutral-100"} strokeWidth={1.5} />
                  <text x={70} y={22} textAnchor="middle" className={`text-[12px] font-medium ${i === 3 ? "fill-neutral-900" : "fill-neutral-500"}`}>
                    {p}
                  </text>
                </g>
              ))}
              {/* Animated routes */}
              {routes.map((target, i) => {
                const y1 = yFor(i, 3) + 20;
                const y2 = yFor(target, 4) + 10;
                const d = `M160 ${y1} C 265 ${y1}, 265 ${y2}, 370 ${y2}`;
                return (
                  <g key={`${i}-${target}`}>
                    <motion.path
                      d={d}
                      className="stroke-neutral-300"
                      strokeWidth={1.5}
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.7, ease: EASE }}
                    />
                    <path d={d} className="stroke-neutral-900 landing-dash" strokeWidth={1.5} fill="none" />
                  </g>
                );
              })}
            </svg>
          </div>
        </Reveal>

        {/* Points */}
        <RevealGroup className="space-y-3">
          {POINTS.map((p) => (
            <RevealItem
              key={p}
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-[14px] font-medium text-neutral-700"
            >
              <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                <path d="M2 6.2 L4.8 9 L10 3.4" className="stroke-neutral-950" strokeWidth={1.6} fill="none" strokeLinecap="round" />
              </svg>
              {p}
            </RevealItem>
          ))}
          <RevealItem className="pt-3">
            <SecondaryCta href="/signup">Explore the Model Hub</SecondaryCta>
          </RevealItem>
        </RevealGroup>
      </div>
    </section>
  );
}

"use client";

/**
 * Landing v3 positioning (Sprint 055) — "Not another AI tool."
 *
 * The category claim, staged as a merge: on the left, today's disconnected AI
 * tools drift apart as loose, tilted cards; on the right, Taurus assembles the
 * same work into one coordinated operating system, row by row. A flowing
 * connection carries the eye left → right so the transformation reads without
 * a word of explanation.
 */

import { motion } from "framer-motion";
import { EASE, Reveal, SectionHeading, SecondaryCta } from "@/components/landing/v3/motion";

const SCATTERED = [
  { label: "Isolated chat windows", tilt: -6, x: -12, y: 0 },
  { label: "Re-explaining the business every time", tilt: 4, x: 16, y: 8 },
  { label: "No memory of your organisation", tilt: -3, x: -6, y: 4 },
  { label: "Copy-paste between tools", tilt: 5, x: 10, y: -6 },
  { label: "Workflows that stop at the chat box", tilt: -5, x: -14, y: 10 },
];

const UNIFIED = [
  "Persistent employee identity",
  "Organisational knowledge built in",
  "Goals, responsibilities and boundaries",
  "Executes across your real tools",
  "Talks on every channel you use",
  "Human approval checkpoints",
  "Performance tracked like a hire",
  "AI Employees that work together",
];

export function Positioning() {
  return (
    <section id="platform" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="Why Taurus AI"
        title="Not another AI [tool.] An operating system for [AI Employees.]"
        description="Chat tools answer questions. Taurus AI hires, trains and manages a workforce — with identity, knowledge, tools, channels and accountability built in."
      />

      <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1.15fr]">
        {/* Left — the scattered status quo */}
        <Reveal className="relative">
          <div className="flex h-full flex-col rounded-3xl border border-dashed border-neutral-300 bg-neutral-50/60 p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              Traditional AI tools
            </p>
            <div className="mt-6 flex flex-1 flex-col justify-center gap-3">
              {SCATTERED.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 18, rotate: 0 }}
                  whileInView={{ opacity: 1, y: card.y, rotate: card.tilt, x: card.x }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.09 }}
                  className="w-fit rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[13px] text-neutral-400 shadow-taurus-sm"
                >
                  {card.label}
                </motion.div>
              ))}
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-neutral-400">
              Every conversation starts from zero. Nothing connects. Nothing is accountable.
            </p>
          </div>
        </Reveal>

        {/* Centre — the flow that merges them */}
        <div className="relative hidden w-16 items-center justify-center lg:flex" aria-hidden>
          <svg viewBox="0 0 64 120" className="h-32 w-16">
            <path d="M4 60 H60" className="stroke-neutral-300" strokeWidth={1.5} fill="none" />
            <path d="M4 60 H60" className="stroke-neutral-900 landing-dash" strokeWidth={1.5} fill="none" />
            <path d="M52 52 L60 60 L52 68" className="stroke-neutral-900" strokeWidth={1.5} fill="none" />
          </svg>
        </div>

        {/* Right — the operating system */}
        <Reveal delay={0.15}>
          <div className="relative h-full overflow-hidden rounded-3xl bg-neutral-950 p-6 text-white shadow-[0_32px_80px_-32px_rgba(0,0,0,0.5)] sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_260px_at_80%_-10%,rgba(255,255,255,0.08),transparent_70%)]"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
                The Taurus AI platform
              </p>
              <span className="flex items-center gap-1.5 rounded-full border border-neutral-700 px-2.5 py-1 text-[10px] font-medium text-neutral-300">
                <span className="landing-blink h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                Operating
              </span>
            </div>
            <motion.ul
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}
              className="mt-6 grid gap-2.5 sm:grid-cols-2"
            >
              {UNIFIED.map((item) => (
                <motion.li
                  key={item}
                  variants={{
                    hidden: { opacity: 0, x: -18 },
                    show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: EASE } },
                  }}
                  className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3.5 py-3 text-[13px] font-medium text-neutral-100"
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden>
                    <path d="M2 6.2 L4.8 9 L10 3.4" className="stroke-white" strokeWidth={1.6} fill="none" strokeLinecap="round" />
                  </svg>
                  {item}
                </motion.li>
              ))}
            </motion.ul>
            <p className="mt-6 text-[13px] leading-relaxed text-neutral-400">
              One identity, one memory, one audit trail — every action authorised and reviewable.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal className="mt-12 text-center">
        <SecondaryCta href="#features">Explore the Taurus AI platform</SecondaryCta>
      </Reveal>
    </section>
  );
}

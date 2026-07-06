"use client";

/**
 * Problem section (Premium Landing v2).
 *
 * Six problem cards drift in scattered and slightly rotated — visual chaos —
 * then a connecting rail shows Taurus pulling them into one governed system.
 */

import { motion } from "framer-motion";
import { Reveal, SectionHeading } from "@/components/landing/reveal";

const PROBLEMS: { title: string; body: string; tilt: number; drift: number }[] = [
  {
    title: "Chatbots without governance",
    body: "Answers no one reviewed, in a voice no one approved.",
    tilt: -3,
    drift: -28,
  },
  {
    title: "Voice tools without memory",
    body: "Every call starts from zero. Nothing carries over.",
    tilt: 2.5,
    drift: 22,
  },
  {
    title: "Internal copilots without ownership",
    body: "Useful for one person. Invisible to the business.",
    tilt: -2,
    drift: -16,
  },
  {
    title: "Model costs without control",
    body: "Every team on a different model, nobody watching spend.",
    tilt: 3,
    drift: 26,
  },
  {
    title: "Knowledge trapped in documents",
    body: "The answers exist — your AI just can't reach them.",
    tilt: -2.5,
    drift: -22,
  },
  {
    title: "No place to manage AI Employees",
    body: "No roster, no rules, no audit trail, no owner.",
    tilt: 2,
    drift: 18,
  },
];

export function ProblemSection() {
  return (
    <section className="relative py-24 sm:py-32" id="product">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="The problem"
          title="AI is everywhere. But your AI workforce is scattered."
          description="Point tools multiply. Governance doesn't. Every new AI surface adds risk, cost, and questions no one owns."
        />

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((problem, index) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 36, x: problem.drift, rotate: problem.tilt }}
              whileInView={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.9, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-colors duration-300 hover:border-white/20"
            >
              <p className="text-[15px] font-semibold text-taurus-text">{problem.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-taurus-faint transition-colors duration-300 group-hover:text-taurus-sub">
                {problem.body}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Chaos resolves: converging rail into Taurus. */}
        <Reveal className="mt-14" delay={0.15}>
          <div className="relative mx-auto flex max-w-xl flex-col items-center">
            <svg aria-hidden viewBox="0 0 320 64" className="h-16 w-80 opacity-80">
              {[40, 120, 200, 280].map((x) => (
                <path
                  key={x}
                  d={`M ${x} 0 C ${x} 36, 160 28, 160 64`}
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1"
                  className="landing-dash-slow"
                />
              ))}
            </svg>
            <div className="rounded-xl border border-white/20 bg-white/[0.06] px-6 py-3 text-sm font-semibold tracking-wide text-taurus-text shadow-[0_0_50px_rgba(255,255,255,0.07)] backdrop-blur">
              Taurus brings it into one system
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

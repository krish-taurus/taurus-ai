"use client";

/**
 * Future ecosystem section (Premium Landing v2).
 *
 * Explicitly future-facing: a constellation of companies and AI Employees with
 * permission gates between them. Copy says "building toward" — no live claims.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Reveal, SectionHeading } from "@/components/landing/reveal";

const NODES: { x: number; y: number; label: string; core?: boolean }[] = [
  { x: 50, y: 50, label: "Your company", core: true },
  { x: 16, y: 26, label: "Design studio" },
  { x: 82, y: 22, label: "Logistics partner" },
  { x: 88, y: 68, label: "Legal firm" },
  { x: 22, y: 76, label: "Accounting firm" },
  { x: 55, y: 12, label: "Agency network" },
];

export function EcosystemSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="What comes next"
          title="The future is an AI workforce network."
          description="Taurus is building toward a trusted ecosystem where companies can create, govern, deploy, and eventually collaborate with specialized AI Employees."
        />

        <Reveal className="mt-16">
          <div
            role="img"
            aria-label="A future network of companies connected through permission gates."
            className="relative mx-auto h-[300px] max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#080808] sm:h-[340px]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_240px_at_50%_50%,rgba(255,255,255,0.05),transparent_70%)]"
            />
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {NODES.slice(1).map((node) => (
                <g key={node.label}>
                  <path
                    d={`M ${node.x} ${node.y} L 50 50`}
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  {!reduceMotion ? (
                    <path
                      d={`M ${node.x} ${node.y} L 50 50`}
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      className="landing-dash-slow"
                    />
                  ) : null}
                  {/* Permission gate at the midpoint. */}
                  <rect
                    x={(node.x + 50) / 2 - 1}
                    y={(node.y + 50) / 2 - 1}
                    width="2"
                    height="2"
                    fill="rgba(3,3,3,1)"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="0.3"
                    transform={`rotate(45 ${(node.x + 50) / 2} ${(node.y + 50) / 2})`}
                  />
                </g>
              ))}
            </svg>
            {NODES.map((node, index) => (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: 0.15 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div
                  className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-medium backdrop-blur ${
                    node.core
                      ? "border-white/25 bg-white/[0.08] text-taurus-text shadow-[0_0_40px_rgba(255,255,255,0.07)]"
                      : "border-white/10 bg-white/[0.03] text-taurus-sub"
                  } ${!reduceMotion && !node.core ? "landing-float-delayed" : ""}`}
                >
                  {node.label}
                </div>
              </motion.div>
            ))}
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-taurus-faint">
              Future ecosystem · permission-gated
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.15} className="mx-auto mt-10 max-w-xl text-center">
          <p className="text-sm text-taurus-faint">Built for the future AI workforce network.</p>
        </Reveal>
      </div>
    </section>
  );
}

"use client";

/**
 * Landing v3 — final cinematic CTA (Sprint 055).
 *
 * The closing scene, pinned and scroll-driven: one AI Employee card floats
 * alone in the dark; as the visitor scrolls, it multiplies into a full digital
 * organisation fanning out behind the headline, which hands over from
 * "The next member of your team is not human." to the invitation to build.
 * Pure transforms driven by scroll progress — cheap, smooth, reversible.
 */

import Link from "next/link";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { Magnetic, usePinnedProgress } from "@/components/landing/v3/motion";

const CARDS = [
  { name: "Nova", role: "Sales", x: -320, y: -150, r: -9, d: 0.0 },
  { name: "Juno", role: "Support", x: 330, y: -130, r: 8, d: 0.05 },
  { name: "Atlas", role: "Analysis", x: -390, y: 90, r: -6, d: 0.1 },
  { name: "Vega", role: "Operations", x: 395, y: 110, r: 7, d: 0.15 },
  { name: "Lyra", role: "Recruiting", x: -180, y: 200, r: -4, d: 0.2 },
  { name: "Orion", role: "Marketing", x: 185, y: 215, r: 5, d: 0.25 },
  { name: "Mira", role: "Finance", x: -95, y: -230, r: 3, d: 0.3 },
  { name: "Rhea", role: "Assistant", x: 110, y: -235, r: -3, d: 0.35 },
];

function FanCard({
  progress,
  card,
}: {
  progress: MotionValue<number>;
  card: (typeof CARDS)[number];
}) {
  const start = 0.12 + card.d;
  const end = Math.min(start + 0.3, 0.9);
  const x = useTransform(progress, [start, end], [0, card.x]);
  const y = useTransform(progress, [start, end], [0, card.y]);
  const rotate = useTransform(progress, [start, end], [0, card.r]);
  const opacity = useTransform(progress, [start, start + 0.08], [0, 1]);
  const scale = useTransform(progress, [start, end], [0.7, 1]);

  return (
    <motion.div
      // Centered via negative margins: framer owns `transform`, so Tailwind's
      // -translate-x/y-1/2 classes would be overwritten by the animation.
      style={{ x, y, rotate, opacity, scale, marginLeft: -88, marginTop: -46 }}
      className="absolute left-1/2 top-1/2 hidden w-44 rounded-2xl border border-neutral-800 bg-neutral-900/85 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur sm:block"
      aria-hidden
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] font-bold text-neutral-950">
          {card.name[0]}
        </span>
        <span>
          <span className="block text-[13px] font-semibold text-white">{card.name}</span>
          <span className="block text-[10px] text-neutral-500">AI {card.role} Employee</span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-neutral-400">
        <span className="landing-blink h-1.5 w-1.5 rounded-full bg-white" />
        Working
      </div>
    </motion.div>
  );
}

export function FinalCta() {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = usePinnedProgress(trackRef);

  // The lone card at the centre gives way as the workforce fans out.
  const heroCardOpacity = useTransform(scrollYProgress, [0, 0.1, 0.2], [1, 1, 0]);
  const heroCardScale = useTransform(scrollYProgress, [0, 0.2], [1, 1.25]);

  // Headline hand-off.
  const line1Opacity = useTransform(scrollYProgress, [0.2, 0.34, 0.52, 0.62], [0, 1, 1, 0]);
  const line1Y = useTransform(scrollYProgress, [0.2, 0.34], [40, 0]);
  const line2Opacity = useTransform(scrollYProgress, [0.62, 0.74], [0, 1]);
  const line2Y = useTransform(scrollYProgress, [0.62, 0.74], [40, 0]);

  // Once the invitation lands, the workforce recedes so the CTAs own the stage.
  const fanOpacity = useTransform(scrollYProgress, [0.58, 0.74], [1, 0.16]);

  return (
    <section aria-label="Build your AI workforce with Taurus AI" className="relative px-3 pb-10 sm:px-5">
      <div ref={trackRef} className="relative h-[280vh]">
        <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden rounded-[2.5rem] bg-neutral-950">
          {/* Atmosphere */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_420px_at_50%_45%,rgba(255,255,255,0.07),transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:80px_80px]"
          />

          {/* The multiplying workforce */}
          <motion.div style={{ opacity: fanOpacity }} className="absolute inset-0" aria-hidden>
            {CARDS.map((card) => (
              <FanCard key={card.name} progress={scrollYProgress} card={card} />
            ))}
          </motion.div>

          {/* The first, lone employee */}
          <motion.div
            style={{ opacity: heroCardOpacity, scale: heroCardScale, marginLeft: -104, marginTop: -58 }}
            className="landing-float absolute left-1/2 top-1/2 w-52 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.9)]"
            aria-hidden
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-neutral-950">
                N
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">Nova</span>
                <span className="block text-[11px] text-neutral-500">Your first AI Employee</span>
              </span>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-400">
              <span className="landing-blink h-1.5 w-1.5 rounded-full bg-white" />
              Ready to start
            </div>
          </motion.div>

          {/* Headlines */}
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <motion.h2
              style={{ opacity: line1Opacity, y: line1Y }}
              className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl"
            >
              The next member of your team
              <span className="text-neutral-500"> is not human.</span>
            </motion.h2>

            <motion.div style={{ opacity: line2Opacity, y: line2Y }} className="absolute inset-x-0 top-0 px-6">
              <h2 className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl">
                Build your AI workforce <span className="text-neutral-500">with Taurus AI.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-neutral-400 sm:text-lg">
                Create specialised AI Employees that understand your business, use your tools and work
                alongside your team.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <Magnetic>
                  <Link
                    href="/signup"
                    className="group inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-sm font-semibold text-neutral-950 transition-shadow duration-300 hover:shadow-[0_0_0_8px_rgba(255,255,255,0.12)]"
                  >
                    Build your first AI Employee
                    <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </Magnetic>
                <Magnetic strength={0.22}>
                  <a
                    href="#contact"
                    className="inline-flex items-center rounded-full border border-neutral-700 px-8 py-4 text-sm font-semibold text-neutral-200 transition-colors duration-300 hover:border-neutral-400 hover:text-white"
                  >
                    Book a personalised demo
                  </a>
                </Magnetic>
              </div>
              <p className="mt-6 text-[13px] text-neutral-500">Start in minutes. Scale when you&rsquo;re ready.</p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

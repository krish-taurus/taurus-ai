"use client";

/**
 * Landing v3 hero (Sprint 055) — "Your company can now hire intelligence."
 *
 * A full-viewport opening scene: oversized editorial headline with a rotating
 * second line, then a living orbital visualisation of a digital organisation —
 * the Taurus core at the centre, specialised AI Employees on the inner ring,
 * business tools on the outer ring, all slowly orbiting while floating cards
 * narrate real actions (reading an enquiry, updating the CRM, scheduling a
 * meeting). Cursor parallax adds depth; scrolling gently releases the scene.
 * Monochrome, SVG + transforms only — no WebGL to load.
 */

import Link from "next/link";
import { AnimatePresence, motion, useScroll, useSpring, useTransform, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { EASE, Magnetic } from "@/components/landing/v3/motion";

const ROTATING = ["Hire AI Employees.", "Train them on your business.", "Deploy them in minutes."];

const LIVE_ACTIONS = [
  { who: "Sales Executive", what: "Reading a new website enquiry" },
  { who: "Support Specialist", what: "Answering from the Knowledge Vault" },
  { who: "Sales Executive", what: "Updating the CRM record" },
  { who: "Executive Assistant", what: "Scheduling a meeting for Thursday" },
  { who: "Data Analyst", what: "Reviewing this week's numbers" },
  { who: "Support Specialist", what: "Escalating a sensitive case to a human" },
  { who: "Operations Manager", what: "Requesting a manager's approval" },
  { who: "Recruiter", what: "Shortlisting matching candidates" },
];

const EMPLOYEES = [
  "Sales Executive",
  "Support Specialist",
  "Recruiter",
  "Data Analyst",
  "Marketing Strategist",
  "Operations Manager",
];

const TOOLS = ["Email", "CRM", "Website chat", "WhatsApp", "Phone", "Calendar", "Knowledge Vault", "Database", "Slack"];

/** One upright chip travelling on an orbit: parent rotates, child counter-rotates. */
function OrbitChip({
  radius,
  angle,
  label,
  kind,
  duration,
}: {
  radius: number;
  angle: number;
  label: string;
  kind: "employee" | "tool";
  duration: 60 | 80;
}) {
  // Parent rotates one way; the child counter-rotates at the same speed so the
  // chip stays upright while its position orbits.
  const orbitClass = duration === 60 ? "landing-orbit" : "landing-orbit-reverse";
  const counterClass = duration === 60 ? "landing-orbit-reverse" : "landing-orbit";
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;
  return (
    <g className={orbitClass} style={{ animationDuration: `${duration}s` }}>
      <g transform={`translate(${x} ${y})`}>
        <g className={counterClass} style={{ animationDuration: `${duration}s` }}>
          {kind === "employee" ? (
            <>
              <rect
                x={-58}
                y={-16}
                width={116}
                height={32}
                rx={16}
                className="fill-white stroke-neutral-300"
                strokeWidth={1}
                style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.10))" }}
              />
              <circle cx={-42} cy={0} r={4} className="fill-neutral-900" />
              <text x={6} y={4} textAnchor="middle" className="fill-neutral-800 text-[11px] font-medium">
                {label}
              </text>
            </>
          ) : (
            <>
              <rect
                x={-44}
                y={-13}
                width={88}
                height={26}
                rx={13}
                className="fill-neutral-50 stroke-neutral-200"
                strokeWidth={1}
              />
              <text x={0} y={4} textAnchor="middle" className="fill-neutral-500 text-[10px]">
                {label}
              </text>
            </>
          )}
        </g>
      </g>
    </g>
  );
}

/** The orbital digital-organisation scene. */
function WorkforceOrbit() {
  return (
    <svg
      viewBox="0 0 1200 560"
      className="h-auto w-full"
      role="img"
      aria-label="A Taurus AI intelligence core orbited by specialised AI Employees connected to business tools like email, CRM, WhatsApp, phone and databases"
    >
      <defs>
        <radialGradient id="hero-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.10)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="72%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>
      </defs>

      <g transform="translate(600 300)">
        {/* Halo + fine rings */}
        <circle r={230} fill="url(#hero-halo)" className="landing-breathe" />
        <circle r={170} className="fill-none stroke-neutral-200" strokeWidth={1} />
        <circle r={170} className="fill-none stroke-neutral-400 landing-dash-slow" strokeWidth={1} />
        <circle r={265} className="fill-none stroke-neutral-200" strokeWidth={1} strokeDasharray="1 6" />
        <circle r={265} className="fill-none stroke-neutral-300 landing-dash-slow" strokeWidth={1} />

        {/* Orbiting pulses on the rings */}
        <g className="landing-orbit" style={{ animationDuration: "24s" }}>
          <circle cx={170} cy={0} r={3.5} className="fill-neutral-900" />
        </g>
        <g className="landing-orbit-reverse" style={{ animationDuration: "34s" }}>
          <circle cx={-265} cy={0} r={3} className="fill-neutral-500" />
        </g>

        {/* Inner ring — AI Employees (upright chips, slow orbit) */}
        {EMPLOYEES.map((label, i) => (
          <OrbitChip
            key={label}
            radius={170}
            angle={(360 / EMPLOYEES.length) * i - 90}
            label={label}
            kind="employee"
            duration={60}
          />
        ))}

        {/* Outer ring — tools (counter-orbit) */}
        {TOOLS.map((label, i) => (
          <OrbitChip
            key={label}
            radius={265}
            angle={(360 / TOOLS.length) * i - 70}
            label={label}
            kind="tool"
            duration={80}
          />
        ))}

        {/* The intelligence core */}
        <g style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,0.22))" }}>
          <rect x={-84} y={-34} width={168} height={68} rx={20} className="fill-neutral-950" />
          <text x={0} y={-4} textAnchor="middle" className="fill-white text-[13px] font-semibold tracking-[0.18em]">
            TAURUS
          </text>
          <text x={0} y={16} textAnchor="middle" className="fill-neutral-400 text-[9px] tracking-[0.3em]">
            AI EMPLOYEE OS
          </text>
        </g>
      </g>

      {/* Fade the scene into the page below */}
      <rect x={0} y={0} width={1200} height={560} fill="url(#hero-fade)" pointerEvents="none" />
    </svg>
  );
}

/** Cycling "live action" narrator card. */
function LiveActionCard({ className, offset = 0 }: { className?: string; offset?: number }) {
  const [i, setI] = useState(offset);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % LIVE_ACTIONS.length), 3200);
    return () => clearInterval(id);
  }, []);
  const action = LIVE_ACTIONS[i];
  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.97 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex items-center gap-3 rounded-2xl border border-neutral-200/90 bg-white/85 px-4 py-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl"
        >
          <span className="landing-blink h-2 w-2 shrink-0 rounded-full bg-neutral-900" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {action.who}
            </p>
            <p className="truncate text-[13px] font-medium text-neutral-900">{action.what}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  // Cursor parallax for the orbital scene.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spx = useSpring(px, { stiffness: 60, damping: 20 });
  const spy = useSpring(py, { stiffness: 60, damping: 20 });

  // Rotating headline line.
  const [line, setLine] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLine((v) => (v + 1) % ROTATING.length), 2900);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      ref={sectionRef}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        px.set((e.clientX / window.innerWidth - 0.5) * 24);
        py.set((e.clientY / window.innerHeight - 0.5) * 16);
      }}
      className="relative overflow-hidden pt-36 sm:pt-44"
      aria-label="Taurus AI — the operating system for AI Employees"
    >
      {/* Fine background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.028)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(900px_500px_at_50%_18%,black,transparent)]"
      />

      <motion.div style={{ y: copyY }} className="relative mx-auto max-w-6xl px-5 text-center sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500 backdrop-blur"
        >
          <span className="landing-blink h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden />
          The operating system for AI Employees
        </motion.p>

        <h1 className="text-balance text-[clamp(2.9rem,8.5vw,7rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-neutral-950">
          <motion.span
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
            className="block"
          >
            Your company can
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.22 }}
            className="block"
          >
            now <span className="text-neutral-400">hire intelligence.</span>
          </motion.span>
        </h1>

        {/* Rotating second line */}
        <div className="mt-7 h-9 sm:h-10" aria-hidden>
          <AnimatePresence mode="wait">
            <motion.p
              key={line}
              initial={{ opacity: 0, y: "60%" }}
              animate={{ opacity: 1, y: "0%" }}
              exit={{ opacity: 0, y: "-60%" }}
              transition={{ duration: 0.5, ease: EASE }}
              className="text-xl font-medium text-neutral-500 sm:text-2xl"
            >
              {ROTATING[line]}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="sr-only">Hire AI Employees. Train them on your business. Deploy them in minutes.</p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.45 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-neutral-500 sm:text-lg"
        >
          Build autonomous AI Employees that understand your organisation, use your tools, talk on your
          channels, run real workflows and work alongside your human team — all from one secure platform.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.58 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Magnetic>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2.5 rounded-full bg-neutral-950 px-8 py-4 text-sm font-semibold text-white transition-shadow duration-300 hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)]"
            >
              Build your first AI Employee
              <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </Magnetic>
          <Magnetic strength={0.22}>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-8 py-4 text-sm font-semibold text-neutral-700 transition-colors duration-300 hover:border-neutral-900 hover:text-neutral-950"
            >
              See Taurus AI in action
            </a>
          </Magnetic>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.75 }}
          className="mt-6 text-[13px] text-neutral-400"
        >
          No credit card required · Deploy your first AI Employee in minutes
        </motion.p>
      </motion.div>

      {/* The living digital organisation */}
      <motion.div
        style={{ y: sceneY, opacity: sceneOpacity }}
        className="relative mx-auto mt-6 max-w-6xl px-2 sm:mt-2"
      >
        <motion.div style={{ x: spx, y: spy }}>
          <WorkforceOrbit />
        </motion.div>

        {/* Floating live-action narrators */}
        <LiveActionCard className="landing-float absolute left-[4%] top-[16%] hidden w-64 md:block" />
        <LiveActionCard offset={3} className="landing-float-delayed absolute right-[4%] top-[38%] hidden w-64 md:block" />
        <LiveActionCard offset={5} className="mx-auto mt-4 w-full max-w-xs md:hidden" />
      </motion.div>
    </section>
  );
}

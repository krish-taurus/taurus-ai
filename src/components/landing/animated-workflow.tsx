"use client";

/**
 * Animated product walkthrough (Premium Landing v2) — the showpiece section.
 *
 * A six-step story from hiring an AI Employee to managing it in the Inbox.
 * Step-based with auto-advance (paused after user interaction and under reduced
 * motion), a live progress rail, and a fully animated preview panel per step.
 */

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { SectionHeading } from "@/components/landing/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;
const STEP_MS = 4600;

const STEPS: { title: string; body: string }[] = [
  {
    title: "Hire an AI Employee",
    body: "Create a role in the Hiring Studio — like posting a job, minus the hiring cycle.",
  },
  {
    title: "Define Employee DNA",
    body: "Mission, responsibilities, communication style, boundaries, and escalation rules.",
  },
  {
    title: "Add Knowledge Vault",
    body: "Assign approved policies, FAQs, and product docs. Answers stay grounded.",
  },
  {
    title: "Choose the Employee Brain",
    body: "Model Hub routes work across Economy, Balanced, Premium, and Privacy First.",
  },
  {
    title: "Deploy to Channels",
    body: "Website, hosted chat, messaging, email, and voice-ready — one click each.",
  },
  {
    title: "Manage from the Inbox",
    body: "Watch conversations, hand off to humans, and resolve work in one place.",
  },
];

/* --- Step visuals ---------------------------------------------------------- */

function rowStagger(index: number) {
  return {
    initial: { opacity: 0, x: -14 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, delay: 0.15 + index * 0.12, ease: EASE },
  };
}

function StepHire() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <motion.p
        {...rowStagger(0)}
        className="text-[11px] font-semibold uppercase tracking-[0.24em] text-taurus-faint"
      >
        Hiring Studio
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
        className="w-64 rounded-2xl border border-white/20 bg-white/[0.06] p-5 shadow-[0_0_60px_rgba(255,255,255,0.06)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/[0.08] text-sm font-semibold text-taurus-text">
            M
          </div>
          <div>
            <p className="text-sm font-semibold text-taurus-text">Maya</p>
            <p className="text-xs text-taurus-faint">AI Sales Assistant</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {["Role: Sales", "Department: Revenue", "Working style: Warm, proactive"].map(
            (line, i) => (
              <motion.p
                key={line}
                {...rowStagger(i + 2)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-taurus-sub"
              >
                {line}
              </motion.p>
            ),
          )}
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-medium text-taurus-text"
        >
          <span aria-hidden className="h-1 w-1 rounded-full bg-white" /> Hired
        </motion.p>
      </motion.div>
    </div>
  );
}

function StepDna() {
  const sections = [
    "Mission",
    "Responsibilities",
    "Communication Style",
    "Boundaries",
    "Escalation Rules",
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-2 sm:px-6">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-taurus-faint">
        Employee DNA
      </p>
      {sections.map((section, i) => (
        <motion.div
          key={section}
          {...rowStagger(i)}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
        >
          <span className="text-sm font-medium text-taurus-text">{section}</span>
          <motion.span
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.12, duration: 0.35, ease: EASE }}
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 text-[10px] text-taurus-text"
          >
            ✓
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

function StepKnowledge() {
  const docs = ["Pricing policy", "Product FAQ", "Onboarding SOP", "Website notes"];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex flex-wrap justify-center gap-2">
        {docs.map((doc, i) => (
          <motion.span
            key={doc}
            initial={{ opacity: 0, y: -26, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.15 + i * 0.14, ease: EASE }}
            className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] text-taurus-sub"
          >
            {doc}
          </motion.span>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        aria-hidden
      >
        <svg viewBox="0 0 120 40" className="h-10 w-32">
          {[20, 60, 100].map((x) => (
            <path
              key={x}
              d={`M ${x} 0 C ${x} 22, 60 18, 60 40`}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1"
              className="landing-dash-slow"
            />
          ))}
        </svg>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.75, ease: EASE }}
        className="rounded-2xl border border-white/20 bg-white/[0.06] px-8 py-4 text-center shadow-[0_0_50px_rgba(255,255,255,0.06)]"
      >
        <p className="text-sm font-semibold text-taurus-text">Knowledge Vault</p>
        <p className="mt-1 text-[11px] text-taurus-faint">4 sources assigned to Maya</p>
      </motion.div>
    </div>
  );
}

function StepBrain() {
  const modes = ["Economy", "Balanced", "Premium", "Privacy First"];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-2 sm:px-6">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-taurus-faint">
        Model Hub
      </p>
      {modes.map((mode, i) => (
        <motion.div
          key={mode}
          {...rowStagger(i)}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
            mode === "Balanced"
              ? "border-white/30 bg-white/[0.07]"
              : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <span className="text-sm font-medium text-taurus-text">{mode}</span>
          {mode === "Balanced" ? (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[#050505]"
            >
              Routed
            </motion.span>
          ) : (
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/25" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

function StepChannels() {
  const channels = ["Website", "Hosted chat", "WhatsApp", "SMS", "Email", "Voice-ready"];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-taurus-faint">
        Channels
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {channels.map((channel, i) => (
          <motion.div
            key={channel}
            initial={{ opacity: 0.25, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, borderColor: "rgba(255,255,255,0.28)" }}
            transition={{ duration: 0.45, delay: 0.2 + i * 0.16, ease: EASE }}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center"
          >
            <p className="text-xs font-medium text-taurus-text">{channel}</p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.16 }}
              className="mt-1 inline-flex items-center gap-1 text-[10px] text-taurus-faint"
            >
              <span aria-hidden className="h-1 w-1 rounded-full bg-white" /> Live
            </motion.p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StepInbox() {
  const rows = [
    { from: "Website visitor", note: "Pricing question", status: "Resolved" },
    { from: "WhatsApp lead", note: "Demo request", status: "Assigned to Sarah" },
    { from: "Email question", note: "Contract terms", status: "Needs human" },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 px-2 sm:px-6">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-taurus-faint">
        Unified Inbox
      </p>
      {rows.map((row, i) => (
        <motion.div
          key={row.from}
          {...rowStagger(i)}
          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-taurus-text">{row.from}</p>
            <p className="truncate text-[11px] text-taurus-faint">{row.note}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-medium text-taurus-sub">
            {row.status}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

const PANELS = [StepHire, StepDna, StepKnowledge, StepBrain, StepChannels, StepInbox];

/* --- Section --------------------------------------------------------------- */

export function AnimatedWorkflow() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { margin: "-30% 0px -30% 0px" });

  // Auto-advance while visible; stop after the user takes control.
  useEffect(() => {
    if (reduceMotion || paused || !inView) return;
    const timer = window.setInterval(() => setActive((v) => (v + 1) % STEPS.length), STEP_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion, paused, inView]);

  const Panel = PANELS[active];

  return (
    <section className="relative py-24 sm:py-32" id="how-it-works" ref={sectionRef}>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From idea to deployed AI Employee in minutes."
          description="The whole lifecycle — hire, train, deploy, manage — as one continuous flow."
        />

        <div className="mt-16 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          {/* Step rail */}
          <ol className="space-y-2" aria-label="Product walkthrough steps">
            {STEPS.map((step, index) => {
              const isActive = index === active;
              return (
                <li key={step.title}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(index);
                      setPaused(true);
                    }}
                    aria-current={isActive ? "step" : undefined}
                    className={`group relative w-full overflow-hidden rounded-xl border px-5 py-4 text-left transition-all duration-300 ${
                      isActive
                        ? "border-white/25 bg-white/[0.06]"
                        : "border-white/[0.07] bg-transparent hover:border-white/15 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-300 ${
                          isActive
                            ? "border-white bg-white text-[#050505]"
                            : "border-white/20 text-taurus-faint"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span>
                        <span
                          className={`block text-sm font-semibold ${isActive ? "text-taurus-text" : "text-taurus-sub"}`}
                        >
                          {step.title}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-taurus-faint">
                          {step.body}
                        </span>
                      </span>
                    </div>
                    {/* Progress bar for the active step. */}
                    {isActive && !reduceMotion && !paused ? (
                      <motion.span
                        key={`progress-${active}`}
                        aria-hidden
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                        className="absolute inset-x-0 bottom-0 h-px origin-left bg-white/40"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Preview panel */}
          <div className="relative min-h-[380px] overflow-hidden rounded-3xl border border-white/10 bg-[#080808] p-4 sm:min-h-[430px]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_260px_at_50%_0%,rgba(255,255,255,0.05),transparent_70%)]"
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.99 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="relative h-full"
              >
                <Panel />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

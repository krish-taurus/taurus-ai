"use client";

/**
 * Landing v3 — How It Works (Sprint 055).
 *
 * The product story as a pinned, scroll-driven film strip: the section is five
 * viewports tall, the stage stays stuck while scroll advances the five steps —
 * choose a role, shape the DNA, load the Knowledge Vault, snap in tools and
 * channels, deploy and improve. Each step swaps in its own animated mini-scene.
 * On mobile the same steps render as a vertical story (no pinning) so nothing
 * is lost on small screens.
 */

import { AnimatePresence, motion, useMotionValueEvent } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import { EASE, Reveal, PrimaryCta, SectionHeading, usePinnedProgress } from "@/components/landing/v3/motion";

/* ------------------------------------------------------------------ */
/* Step scenes                                                          */
/* ------------------------------------------------------------------ */

const ROLES = [
  "Sales Development Rep",
  "Support Specialist",
  "Recruiter",
  "Executive Assistant",
  "Data Analyst",
  "Marketing Coordinator",
];

function SceneRoles() {
  return (
    <div className="grid grid-cols-2 gap-3 p-6 sm:p-8">
      {ROLES.map((role, i) => (
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE, delay: i * 0.07 }}
          className={`rounded-2xl border p-4 ${
            i === 0 ? "border-neutral-900 bg-neutral-950 text-white shadow-lg" : "border-neutral-200 bg-white"
          }`}
        >
          <div
            className={`mb-3 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
              i === 0 ? "bg-white text-neutral-950" : "bg-neutral-100 text-neutral-500"
            }`}
            aria-hidden
          >
            {role
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </div>
          <p className={`text-[13px] font-semibold ${i === 0 ? "text-white" : "text-neutral-900"}`}>{role}</p>
          <p className={`mt-1 text-[11px] ${i === 0 ? "text-neutral-400" : "text-neutral-400"}`}>
            {i === 0 ? "Selected — ready to shape" : "Start from this role"}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

const DNA_TRAITS = [
  { k: "Role", v: "Sales Development Rep" },
  { k: "Goal", v: "Qualify and book meetings" },
  { k: "Personality", v: "Warm · Concise · Direct" },
  { k: "Boundaries", v: "Never quotes custom pricing" },
  { k: "Escalation", v: "Discounts → human manager" },
  { k: "Hours", v: "Always on · 24/7" },
];

function SceneDna() {
  return (
    <div className="flex h-full items-center gap-6 p-6 sm:p-8">
      {/* A structured intelligence strand assembling */}
      <svg viewBox="0 0 60 300" className="hidden h-64 w-12 shrink-0 sm:block" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <g key={i}>
            <motion.path
              d={`M10 ${20 + i * 40} C 30 ${30 + i * 40}, 30 ${50 + i * 40}, 50 ${60 + i * 40}`}
              className="stroke-neutral-300"
              strokeWidth={1.5}
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.1 }}
            />
            <motion.circle
              cx={10}
              cy={20 + i * 40}
              r={4}
              className="fill-neutral-900"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            />
            <motion.circle
              cx={50}
              cy={60 + i * 40}
              r={4}
              className="fill-neutral-300"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
            />
          </g>
        ))}
      </svg>
      <div className="flex-1 space-y-2.5">
        {DNA_TRAITS.map((t, i) => (
          <motion.div
            key={t.k}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: i * 0.09 }}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{t.k}</span>
            <span className="text-[13px] font-medium text-neutral-900">{t.v}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const KNOWLEDGE_SOURCES = ["Product catalogue.pdf", "Refund policy.docx", "FAQ pages", "CRM records", "Postgres database", "Google Drive folder"];

function SceneKnowledge() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center p-6 sm:p-8">
      <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3">
        {KNOWLEDGE_SOURCES.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, y: -26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: i * 0.1 }}
            className="truncate rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-center text-[12px] font-medium text-neutral-600"
          >
            {s}
          </motion.div>
        ))}
      </div>
      <svg viewBox="0 0 200 60" className="my-2 h-14 w-48" aria-hidden>
        {[40, 100, 160].map((x) => (
          <g key={x}>
            <path d={`M${x} 4 V56`} className="stroke-neutral-200" strokeWidth={1.5} />
            <path d={`M${x} 4 V56`} className="stroke-neutral-900 landing-dash" strokeWidth={1.5} />
          </g>
        ))}
      </svg>
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
        className="w-full max-w-sm rounded-2xl bg-neutral-950 px-6 py-5 text-center shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)]"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">Knowledge Vault</p>
        <p className="mt-1 text-sm font-medium text-white">Secure, private, per-organisation</p>
        <p className="mt-2 text-[12px] text-neutral-400">Answers stay grounded in your company&rsquo;s information</p>
      </motion.div>
    </div>
  );
}

const CONNECTORS = ["Gmail", "Outlook", "Slack", "WhatsApp", "Website chat", "Phone", "HubSpot", "Salesforce", "Calendar", "Postgres", "SharePoint", "REST API"];

function SceneConnectors() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 sm:p-8">
      <div className="relative flex w-full flex-wrap items-center justify-center gap-2.5">
        {CONNECTORS.map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, scale: 0.6, rotate: i % 2 ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 18, delay: i * 0.08 }}
            className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-[12px] font-medium text-neutral-700 shadow-taurus-sm"
          >
            {c}
          </motion.span>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        className="mt-8 rounded-full bg-neutral-100 px-4 py-2 text-[12px] font-medium text-neutral-500"
      >
        Connectors snap in — no engineering project required
      </motion.p>
    </div>
  );
}

const DEPLOY_FEED = [
  { t: "09:02", a: "Replied to 3 website enquiries" },
  { t: "09:14", a: "Booked a meeting with Meridian Ltd" },
  { t: "09:20", a: "Updated 6 CRM records" },
  { t: "09:31", a: "Escalated a pricing question to Maya" },
  { t: "09:44", a: "Weekly numbers sent to #revenue" },
];

function SceneDeploy() {
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 p-6 sm:p-8">
      <div className="mb-2 flex items-center justify-between rounded-2xl bg-neutral-950 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">Nova · Sales Development Rep</p>
          <p className="text-[11px] text-neutral-400">Deployed · working across 4 channels</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-neutral-700 px-2.5 py-1 text-[10px] font-medium text-neutral-200">
          <span className="landing-blink h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
          Live
        </span>
      </div>
      {DEPLOY_FEED.map((row, i) => (
        <motion.div
          key={row.t}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.15 + i * 0.12 }}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2.5"
        >
          <span className="text-[11px] tabular-nums text-neutral-400">{row.t}</span>
          <span className="text-[13px] text-neutral-700">{row.a}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The steps                                                            */
/* ------------------------------------------------------------------ */

interface Step {
  n: string;
  title: string;
  body: string;
  scene: ReactNode;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Choose a role",
    body: "Start in the Hiring Studio: pick from ready-made roles — sales, support, recruiting, analysis, operations — or hire a proven AI Employee straight from the Marketplace.",
    scene: <SceneRoles />,
  },
  {
    n: "02",
    title: "Shape the Employee DNA",
    body: "Define who this employee is: goals, responsibilities, personality, communication style, decision boundaries, escalation rules and working hours — a structured identity, not a wall of text.",
    scene: <SceneDna />,
  },
  {
    n: "03",
    title: "Load the Knowledge Vault",
    body: "Upload documents, add pages, sync Google Drive, SharePoint, cloud storage or a live database. Your AI Employee answers from your company's information — and cites where it looked.",
    scene: <SceneKnowledge />,
  },
  {
    n: "04",
    title: "Connect tools and channels",
    body: "Snap in email, Slack, WhatsApp, SMS, website chat, phone, calendars, CRMs and databases. One employee, everywhere your customers and team already are.",
    scene: <SceneConnectors />,
  },
  {
    n: "05",
    title: "Deploy and improve",
    body: "Go live in one click. Watch the work happen in real time, review performance like any hire, approve sensitive actions, and let scheduled retraining keep knowledge fresh.",
    scene: <SceneDeploy />,
  },
];

/* ------------------------------------------------------------------ */
/* Pinned desktop experience + stacked mobile story                     */
/* ------------------------------------------------------------------ */

export function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const scrollYProgress = usePinnedProgress(trackRef);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  return (
    <section id="how-it-works" className="relative scroll-mt-24 bg-neutral-50/60 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From job description to working [AI Employee] in five minutes."
          description="No code. No deployment team. A guided path from role to live, accountable digital employee."
        />
      </div>

      {/* Desktop: pinned film strip */}
      <div ref={trackRef} className="relative mx-auto mt-10 hidden max-w-6xl px-8 lg:block" style={{ height: `${STEPS.length * 90}vh` }}>
        <div className="sticky top-0 flex h-screen items-center">
          <div className="grid w-full grid-cols-[0.9fr_1.1fr] items-center gap-16">
            {/* Step rail */}
            <div>
              {STEPS.map((step, i) => {
                const isActive = i === active;
                return (
                  <div key={step.n} className="relative border-l border-neutral-200 py-5 pl-8">
                    <motion.span
                      aria-hidden
                      className="absolute -left-px top-0 w-px bg-neutral-950"
                      initial={false}
                      animate={{ height: isActive ? "100%" : "0%" }}
                      transition={{ duration: 0.5, ease: EASE }}
                    />
                    <motion.div
                      initial={false}
                      animate={{ opacity: isActive ? 1 : 0.34 }}
                      transition={{ duration: 0.4 }}
                    >
                      <p className="text-[11px] font-semibold tracking-[0.3em] text-neutral-400">STEP {step.n}</p>
                      <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-950">{step.title}</h3>
                      <motion.p
                        initial={false}
                        animate={{ height: isActive ? "auto" : 0, opacity: isActive ? 1 : 0 }}
                        transition={{ duration: 0.45, ease: EASE }}
                        className="overflow-hidden text-[15px] leading-relaxed text-neutral-500"
                      >
                        <span className="block pt-2.5">{step.body}</span>
                      </motion.p>
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {/* Morphing stage */}
            <div className="relative h-[560px] overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 shadow-taurus-lift">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.025)_1px,transparent_1px)] bg-[size:40px_40px]"
              />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 34, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -34, scale: 0.985 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="absolute inset-0"
                >
                  {STEPS[active].scene}
                </motion.div>
              </AnimatePresence>
              {/* Progress dots */}
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-400 ${
                      i === active ? "w-6 bg-neutral-950" : "w-1.5 bg-neutral-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: stacked story */}
      <div className="mx-auto mt-12 max-w-xl space-y-10 px-5 lg:hidden">
        {STEPS.map((step) => (
          <Reveal key={step.n}>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-neutral-400">STEP {step.n}</p>
            <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-950">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">{step.body}</p>
            <div className="relative mt-4 min-h-[380px] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
              {step.scene}
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-16 text-center">
        <PrimaryCta href="/signup">Create an AI Employee</PrimaryCta>
      </Reveal>
    </section>
  );
}

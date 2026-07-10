"use client";

/**
 * Landing v3 — the AI Employee Control Centre showcase (Sprint 055).
 *
 * A large product frame that behaves like the real dashboard: an employee
 * directory on the left (hover/tap a row to switch the detail view), live
 * status dots, counting metrics and an activity trace. The whole frame arrives
 * with a scroll-driven "camera" move (rotates flat + scales up as it enters)
 * and answers the cursor with a gentle 3D tilt.
 */

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { CountUp, Reveal, SectionHeading, SecondaryCta, TiltCard, EASE } from "@/components/landing/v3/motion";

const EMPLOYEES = [
  {
    name: "Nova",
    role: "Sales Development Rep",
    status: "Working",
    focus: "Qualifying 3 inbound leads",
    channels: ["Website chat", "Email", "WhatsApp"],
    metrics: [
      { k: "Leads qualified", v: 128 },
      { k: "Meetings booked", v: 34 },
      { k: "Avg response", v: 8, suffix: "s" },
    ],
    trace: ["Read enquiry from meridian.com", "Checked CRM history", "Sent qualification questions", "Booked Thursday 14:00"],
  },
  {
    name: "Juno",
    role: "Support Specialist",
    status: "Working",
    focus: "Resolving order-status tickets",
    channels: ["WhatsApp", "Website chat", "SMS"],
    metrics: [
      { k: "Tickets resolved", v: 412 },
      { k: "Escalated safely", v: 23 },
      { k: "First response", v: 5, suffix: "s" },
    ],
    trace: ["Identified returning customer", "Searched the Knowledge Vault", "Sent refund policy summary", "Updated the ticket"],
  },
  {
    name: "Atlas",
    role: "Data Analyst",
    status: "Scheduled",
    focus: "Weekly revenue report · Mondays 08:00",
    channels: ["Slack", "Email"],
    metrics: [
      { k: "Reports delivered", v: 56 },
      { k: "Sources cited", v: 100, suffix: "%" },
      { k: "Hours saved / wk", v: 11 },
    ],
    trace: ["Queried the sales database", "Validated the data", "Built the weekly summary", "Posted to #revenue with sources"],
  },
  {
    name: "Vega",
    role: "Operations Manager",
    status: "Awaiting approval",
    focus: "Purchase order over threshold",
    channels: ["Email", "Slack"],
    metrics: [
      { k: "Workflows run", v: 310 },
      { k: "Approvals requested", v: 41 },
      { k: "Audit events", v: 2748 },
    ],
    trace: ["Received supplier invoice", "Checked business rules", "Paused the workflow", "Requested manager approval"],
  },
];

export function ControlCenter() {
  const [selected, setSelected] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: frameRef, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const emp = EMPLOYEES[selected];

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="The Control Centre"
        title="Every AI Employee. One intelligent [Control Centre.]"
        description="Build, monitor and manage your digital workforce from one secure place — objectives, channels, knowledge, workflows, approvals, audit history, model choice and cost."
      />

      <div style={{ perspective: 1400 }}>
        <motion.div ref={frameRef} style={{ rotateX, scale }} className="mt-14 will-change-transform">
          <TiltCard max={3} className="mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_48px_120px_-48px_rgba(0,0,0,0.35)]">
              {/* Window chrome */}
              <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
                <div className="flex items-center gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
                </div>
                <p className="text-[11px] font-medium tracking-[0.22em] text-neutral-400">TAURUS AI · CONTROL CENTRE</p>
                <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <span className="landing-blink h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden />
                  Live
                </span>
              </div>

              <div className="grid md:grid-cols-[280px_1fr]">
                {/* Directory */}
                <div className="border-b border-neutral-100 p-3 md:border-b-0 md:border-r">
                  <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                    AI Employees · {EMPLOYEES.length} active
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 md:grid-cols-1">
                    {EMPLOYEES.map((e, i) => (
                      <button
                        key={e.name}
                        type="button"
                        onMouseEnter={() => setSelected(i)}
                        onFocus={() => setSelected(i)}
                        onClick={() => setSelected(i)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ${
                          i === selected ? "bg-neutral-950 text-white" : "hover:bg-neutral-50"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className={`text-[13px] font-semibold ${i === selected ? "text-white" : "text-neutral-900"}`}>
                            {e.name}
                          </span>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              e.status === "Working" ? "landing-blink bg-white" : "bg-neutral-400"
                            } ${i === selected ? "" : "!bg-neutral-300"}`}
                            aria-hidden
                          />
                        </span>
                        <span className={`block truncate text-[11px] ${i === selected ? "text-neutral-400" : "text-neutral-400"}`}>
                          {e.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Detail */}
                <div className="relative min-h-[380px] p-5 sm:p-6">
                  <motion.div
                    key={selected}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-950">
                          {emp.name} <span className="font-normal text-neutral-400">· {emp.role}</span>
                        </h3>
                        <p className="mt-0.5 text-[13px] text-neutral-500">{emp.focus}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          emp.status === "Awaiting approval"
                            ? "border border-neutral-300 text-neutral-600"
                            : "bg-neutral-950 text-white"
                        }`}
                      >
                        {emp.status}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {emp.metrics.map((m) => (
                        <div key={m.k} className="rounded-2xl border border-neutral-200 bg-neutral-50/70 px-4 py-3.5">
                          <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-950">
                            <CountUp to={m.v} suffix={m.suffix ?? ""} duration={1.1} />
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-400">{m.k}</p>
                        </div>
                      ))}
                    </div>

                    {/* Channels + trace */}
                    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1.4fr]">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Channels</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {emp.channels.map((c) => (
                            <span key={c} className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-600">
                              {c}
                            </span>
                          ))}
                        </div>
                        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Governance</p>
                        <div className="mt-2 space-y-1.5 text-[12px] text-neutral-500">
                          <p>✓ Approval checkpoints on</p>
                          <p>✓ Full audit trail</p>
                          <p>✓ Usage limits enforced</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Latest run</p>
                        <div className="mt-2 space-y-1.5">
                          {emp.trace.map((t, i) => (
                            <motion.div
                              key={t}
                              initial={{ opacity: 0, x: 14 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.35, ease: EASE, delay: 0.1 + i * 0.08 }}
                              className="flex items-center gap-2.5 rounded-lg border border-neutral-100 bg-white px-3 py-2 text-[12px] text-neutral-600"
                            >
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-neutral-100 text-[9px] font-bold text-neutral-500">
                                {i + 1}
                              </span>
                              {t}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </TiltCard>
        </motion.div>
      </div>

      <Reveal className="mt-10 text-center">
        <p className="mx-auto mb-6 max-w-xl text-sm text-neutral-400">
          Directory · objectives · tasks · channels · knowledge · conversations · workflow activity ·
          performance · approvals · audit log · model selection · cost controls
        </p>
        <SecondaryCta href="#features">See the platform</SecondaryCta>
      </Reveal>
    </section>
  );
}

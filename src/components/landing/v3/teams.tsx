"use client";

/**
 * Landing v3 — built for every team (Sprint 055).
 *
 * An interactive department selector: pick a team, the stage re-casts itself —
 * the AI Employees that fit, what they take off the team's plate, and the
 * channels they'd work. Tabs are real buttons (keyboard-friendly), the swap is
 * a single choreographed exit/enter.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { EASE, Reveal, SectionHeading, SecondaryCta } from "@/components/landing/v3/motion";

interface Dept {
  tab: string;
  employees: { name: string; does: string }[];
  outcome: string;
  channels: string[];
}

const DEPTS: Dept[] = [
  {
    tab: "Sales",
    employees: [
      { name: "Lead Qualifier", does: "Answers every enquiry, qualifies intent, books meetings" },
      { name: "Follow-up Specialist", does: "Chases every open opportunity until it closes or dies" },
      { name: "CRM Keeper", does: "Keeps every record current without a human typing" },
    ],
    outcome: "Every lead answered, every follow-up sent, CRM always current.",
    channels: ["Website chat", "Email", "WhatsApp", "Phone"],
  },
  {
    tab: "Support",
    employees: [
      { name: "First-line Specialist", does: "Resolves repetitive questions from the Knowledge Vault" },
      { name: "Order Assistant", does: "Handles status, returns and account questions" },
      { name: "Escalation Router", does: "Hands sensitive cases to humans with full context" },
    ],
    outcome: "Instant answers around the clock, humans reserved for the hard cases.",
    channels: ["Website chat", "WhatsApp", "SMS", "Email"],
  },
  {
    tab: "Recruitment",
    employees: [
      { name: "Application Screener", does: "Reads every application against the role's requirements" },
      { name: "Candidate Concierge", does: "Keeps candidates informed and engaged" },
      { name: "Interview Coordinator", does: "Solves the scheduling ping-pong" },
    ],
    outcome: "A ranked shortlist and a candidate experience that never goes quiet.",
    channels: ["Email", "WhatsApp", "Website chat"],
  },
  {
    tab: "Marketing",
    employees: [
      { name: "Content Researcher", does: "Gathers grounded source material for every piece" },
      { name: "Campaign Coordinator", does: "Keeps launches and assets moving on schedule" },
      { name: "Reporting Analyst", does: "Turns campaign data into a weekly readout" },
    ],
    outcome: "Research, coordination and reporting on autopilot — creativity stays human.",
    channels: ["Slack", "Email"],
  },
  {
    tab: "Operations",
    employees: [
      { name: "Workflow Runner", does: "Executes recurring processes step by step" },
      { name: "Approvals Clerk", does: "Routes the right decisions to the right manager" },
      { name: "Systems Updater", does: "Moves information between tools without re-keying" },
    ],
    outcome: "Recurring processes run themselves, with an audit trail for every step.",
    channels: ["Email", "Slack", "Database"],
  },
  {
    tab: "Finance",
    employees: [
      { name: "Invoice Processor", does: "Extracts, checks and files incoming invoices" },
      { name: "Spend Watcher", does: "Flags anything outside policy for human review" },
      { name: "Reporting Assistant", does: "Prepares the monthly numbers pack" },
    ],
    outcome: "Clean books, faster closes, and a human sign-off on everything sensitive.",
    channels: ["Email", "Database", "Slack"],
  },
  {
    tab: "Data",
    employees: [
      { name: "Business Analyst", does: "Answers questions from authorised data, sources cited" },
      { name: "Report Scheduler", does: "Delivers the same trusted report every week" },
      { name: "Data Quality Checker", does: "Flags gaps and anomalies before they mislead" },
    ],
    outcome: "On-demand answers with traceable sources instead of week-long waits.",
    channels: ["Slack", "Email", "Database"],
  },
  {
    tab: "Leadership",
    employees: [
      { name: "Executive Assistant", does: "Briefs, schedules, drafts and tracks commitments" },
      { name: "Meeting Preparer", does: "One page of context before every conversation" },
      { name: "Decision Tracker", does: "Nothing agreed is ever forgotten" },
    ],
    outcome: "Every leader starts the day with a brief, not a backlog.",
    channels: ["Email", "Slack", "Calendar"],
  },
];

export function Teams() {
  const [active, setActive] = useState(0);
  const dept = DEPTS[active];

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="Built for every team"
        title="Pick a department. [Meet its new hires.]"
        description="Wherever repetitive work piles up, there's an AI Employee shaped for it."
      />

      {/* Tabs */}
      <Reveal className="mt-12">
        <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Departments">
          {DEPTS.map((d, i) => (
            <button
              key={d.tab}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-300 ${
                i === active
                  ? "bg-neutral-950 text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]"
                  : "border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900"
              }`}
            >
              {d.tab}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Stage */}
      <div className="mt-10 min-h-[340px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="grid gap-4 md:grid-cols-3"
          >
            {dept.employees.map((e, i) => (
              <motion.div
                key={e.name}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.08 + i * 0.08 }}
                className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-taurus-sm transition-shadow duration-300 hover:shadow-taurus-lift"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 text-[13px] font-bold text-white" aria-hidden>
                  {e.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <h3 className="mt-4 text-base font-semibold text-neutral-950">{e.name}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{e.does}</p>
              </motion.div>
            ))}
            <div className="md:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-neutral-50 px-6 py-5">
                <p className="text-[14px] font-medium text-neutral-700">{dept.outcome}</p>
                <div className="flex flex-wrap gap-1.5">
                  {dept.channels.map((c) => (
                    <span key={c} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] text-neutral-500">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <Reveal className="mt-10 text-center">
        <SecondaryCta href="/marketplace">Find an AI Employee for your team</SecondaryCta>
      </Reveal>
    </section>
  );
}

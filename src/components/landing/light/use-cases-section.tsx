"use client";

/**
 * Use cases section (Sprint 020) — the centerpiece the user asked for:
 * "step-by-step animations to show the use cases."
 *
 * Five domains, each an alternating full-width row that reveals as it scrolls into
 * view: a big index numeral, the problem, the solution, and one illustrative stat.
 * The problem→solution→stat elements stage in sequence for a walkthrough feel.
 * A single honest disclosure makes clear the stats are illustrative scenarios,
 * not published customer results (no fabricated named customers).
 */

import { motion } from "framer-motion";
import { Reveal } from "@/components/landing/reveal";
import { SectionHeadingLight } from "@/components/landing/light/section-heading-light";
import {
  IconCart,
  IconStethoscope,
  IconBriefcase,
  IconChat,
  IconBuilding,
} from "@/components/landing/light/illustrations";

const EASE = [0.16, 1, 0.3, 1] as const;

type UseCase = {
  n: string;
  domain: string;
  role: string;
  icon: (p: { className?: string }) => JSX.Element;
  problem: string;
  solution: string;
  statValue: string;
  statLabel: string;
};

const USE_CASES: UseCase[] = [
  {
    n: "01",
    domain: "E-commerce & Retail",
    role: "AI Sales Assistant",
    icon: IconCart,
    problem:
      "Shoppers ask about sizing, stock, and shipping at midnight — and bounce when no one answers.",
    solution:
      "An AI Sales Assistant greets every visitor, answers from your catalog and policies, and guides them to checkout across web, WhatsApp, and SMS.",
    statValue: "3×",
    statLabel: "more after-hours conversations captured",
  },
  {
    n: "02",
    domain: "Clinics & Healthcare",
    role: "AI Receptionist",
    icon: IconStethoscope,
    problem:
      "Front desks miss calls during visits, and patients wait on hold to book or reschedule.",
    solution:
      "An AI Receptionist handles intake, answers common questions from your policies, books appointments, and escalates anything clinical to a human.",
    statValue: "80%",
    statLabel: "of routine front-desk questions handled",
  },
  {
    n: "03",
    domain: "Professional Services",
    role: "AI Intake Assistant",
    icon: IconBriefcase,
    problem:
      "Qualified leads slip away while partners are billing hours and can't respond in time.",
    solution:
      "An AI Intake Assistant qualifies new matters, collects the right details, and books consultations — following your boundaries and escalation rules.",
    statValue: "24/7",
    statLabel: "intake with no missed leads",
  },
  {
    n: "04",
    domain: "SaaS & Support",
    role: "AI Customer Support Employee",
    icon: IconChat,
    problem:
      "Support queues balloon with repeat questions your docs already answer.",
    solution:
      "An AI Customer Support Employee resolves the repetitive tickets from your Knowledge Vault and hands the hard ones to your team with full context.",
    statValue: "60%",
    statLabel: "of tickets deflected before a human",
  },
  {
    n: "05",
    domain: "Operations & HR",
    role: "AI Internal Knowledge Assistant",
    icon: IconBuilding,
    problem:
      "Teams ping each other all day for the same policy, process, and how-to answers.",
    solution:
      "An AI Internal Knowledge Assistant answers staff questions from your internal docs — same DNA, same governance, on the channels your team already uses.",
    statValue: "min→sec",
    statLabel: "to find an internal answer",
  },
];

function UseCaseRow({ useCase, index }: { useCase: UseCase; index: number }) {
  const Icon = useCase.icon;
  const flip = index % 2 === 1;

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-120px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } } }}
      className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16 ${
        flip ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      {/* Narrative column — staged problem → solution → stat. */}
      <div>
        <motion.div
          variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
          className="flex items-center gap-4"
        >
          <span className="text-6xl font-semibold tracking-tight text-neutral-200 sm:text-7xl">
            {useCase.n}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {useCase.domain}
            </p>
            <p className="text-lg font-semibold text-neutral-900">{useCase.role}</p>
          </div>
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
          className="mt-8 border-l-2 border-neutral-200 pl-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            The problem
          </p>
          <p className="mt-2 text-xl leading-snug text-neutral-500 sm:text-2xl">{useCase.problem}</p>
        </motion.div>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }}
          className="mt-6 border-l-2 border-neutral-900 pl-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            With a Taurus AI Employee
          </p>
          <p className="mt-2 text-xl font-medium leading-snug text-neutral-900 sm:text-2xl">
            {useCase.solution}
          </p>
        </motion.div>
      </div>

      {/* Visual column — big icon plate + illustrative stat. */}
      <motion.div
        variants={{ hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE } } }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-neutral-900 text-white">
            <Icon className="h-10 w-10" />
          </div>
          <div className="mt-10">
            <p className="text-6xl font-semibold tracking-tight text-neutral-900 sm:text-7xl">
              {useCase.statValue}
            </p>
            <p className="mt-2 text-base text-neutral-500">{useCase.statLabel}</p>
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full border border-neutral-200"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function UseCasesSection() {
  return (
    <section className="relative bg-neutral-50 py-24 sm:py-32" id="use-cases">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeadingLight
          eyebrow="Use cases"
          title="One platform. Every kind of front-line work."
          description="Scroll through five ways teams put AI Employees to work — the problem, the Taurus solution, and the outcome to expect."
        />

        <div className="mt-20 space-y-24 sm:space-y-32">
          {USE_CASES.map((useCase, index) => (
            <UseCaseRow key={useCase.n} useCase={useCase} index={index} />
          ))}
        </div>

        <Reveal className="mx-auto mt-20 max-w-2xl text-center">
          <p className="text-sm text-neutral-400">
            Illustrative scenarios to show how AI Employees are used — not published results from named
            customers. Your outcomes depend on your knowledge, DNA, and workflows.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

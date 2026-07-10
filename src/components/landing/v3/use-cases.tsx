"use client";

/**
 * Landing v3 — STAR use-case stories (Sprint 055).
 *
 * Six mini-films told as a stacked card deck: each story card pins near the
 * top of the viewport and the next one slides over it while the pinned card
 * recedes (scales down, dims) — a physical, deliberate rhythm instead of a
 * grid of feature tiles. Every card runs the STAR arc: Situation → Task →
 * an animated Action trace → counted Results. Scenarios are clearly marked
 * illustrative; no invented customers or statistics.
 */

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { CountUp, EASE, Magnetic, Reveal, SectionHeading } from "@/components/landing/v3/motion";

interface Story {
  tag: string;
  headline: string;
  situation: string;
  task: string;
  actions: string[];
  results: { v: number; suffix: string; k: string }[];
  cta: string;
  dark: boolean;
}

const STORIES: Story[] = [
  {
    tag: "AI Sales Employee",
    headline: "Every lead gets a response. Every opportunity gets followed up.",
    situation:
      "Leads arrive from the website, email, ads and social — faster than the sales team can answer. The slowest replies quietly become lost revenue.",
    task: "Qualify every lead, answer first questions, spot buying intent and book meetings for the humans.",
    actions: [
      "Receives a website enquiry",
      "Reads the lead's company details",
      "Asks qualification questions",
      "Checks the CRM history",
      "Sends a personalised follow-up",
      "Books the meeting, updates the CRM",
      "Alerts the human sales rep",
    ],
    results: [
      { v: 24, suffix: "/7", k: "coverage, every channel" },
      { v: 100, suffix: "%", k: "of leads followed up" },
      { v: 0, suffix: "", k: "CRM records typed by hand" },
    ],
    cta: "Hire an AI Sales Employee",
    dark: true,
  },
  {
    tag: "AI Support Employee",
    headline: "Resolve more requests without losing the human touch.",
    situation: "Support drowns in repetitive questions across chat, email and WhatsApp while complex cases wait in the same queue.",
    task: "Answer instantly from company knowledge — and hand sensitive cases to a human with full context.",
    actions: [
      "Identifies the customer",
      "Pulls the order details",
      "Searches the Knowledge Vault",
      "Sends a personalised answer",
      "Updates the ticket",
      "Detects frustration in a reply",
      "Escalates to a human with a summary",
    ],
    results: [
      { v: 5, suffix: "s", k: "typical first response" },
      { v: 100, suffix: "%", k: "answers grounded in your docs" },
      { v: 1, suffix: " click", k: "human handover, full context" },
    ],
    cta: "Build an AI support team",
    dark: false,
  },
  {
    tag: "AI Recruitment Employee",
    headline: "From thousands of applications to the right candidates.",
    situation: "Recruiters lose hours to manual screening, repetitive outreach and interview scheduling ping-pong.",
    task: "Surface the candidates worth a human's time and run the early-stage process end to end.",
    actions: [
      "Reads the job requirements",
      "Screens incoming profiles",
      "Matches skills and experience",
      "Ranks the shortlist",
      "Sends personalised outreach",
      "Collects screening answers",
      "Coordinates interview slots",
    ],
    results: [
      { v: 90, suffix: "%", k: "less manual screening" },
      { v: 100, suffix: "%", k: "of applicants get a reply" },
      { v: 1, suffix: " list", k: "ranked, evidence-backed shortlist" },
    ],
    cta: "Hire an AI Recruiter",
    dark: false,
  },
  {
    tag: "AI Data Analyst",
    headline: "Turn business questions into trusted answers.",
    situation: "Leaders wait days for reports because the numbers live across spreadsheets, databases and tools.",
    task: "Answer business questions from authorised data — with the source attached, never a guess.",
    actions: [
      "Receives a business question",
      "Connects to authorised sources",
      "Checks the data quality",
      "Runs the analysis",
      "Builds a visual report",
      "Explains the findings in plain language",
      "Cites every underlying source",
    ],
    results: [
      { v: 100, suffix: "%", k: "answers with sources cited" },
      { v: 0, suffix: "", k: "unsupported conclusions" },
      { v: 8, suffix: "am", k: "your Monday report, every Monday" },
    ],
    cta: "Deploy an AI Analyst",
    dark: false,
  },
  {
    tag: "AI Operations Employee",
    headline: "Keep the business moving while your team focuses on growth.",
    situation: "Operations re-keys the same information between email, spreadsheets, calendars and approval chains — and things slip.",
    task: "Run the recurring workflows, follow the business rules, and make sure nothing is ever missed.",
    actions: [
      "Monitors incoming requests",
      "Extracts the key information",
      "Checks the business rules",
      "Updates internal systems",
      "Pauses for manager approval",
      "Schedules the next action",
      "Writes every step to the audit log",
    ],
    results: [
      { v: 100, suffix: "%", k: "of steps in the audit trail" },
      { v: 0, suffix: "", k: "requests dropped between tools" },
      { v: 1, suffix: " place", k: "to see every running workflow" },
    ],
    cta: "Automate an operations workflow",
    dark: false,
  },
  {
    tag: "Executive AI Assistant",
    headline: "Give every leader an intelligent chief of staff.",
    situation: "Executives start each day buried in unread threads, back-to-back meetings and commitments scattered across tools.",
    task: "Turn the noise into a brief: what matters, what's urgent, what was promised — before the day begins.",
    actions: [
      "Summarises the overnight inbox",
      "Prepares each meeting brief",
      "Flags the decisions that can't wait",
      "Coordinates calendar conflicts",
      "Drafts the follow-ups",
      "Tracks every commitment made",
      "Delivers the daily briefing at 7:30",
    ],
    results: [
      { v: 730, suffix: "am", k: "daily executive briefing" },
      { v: 100, suffix: "%", k: "commitments tracked" },
      { v: 1, suffix: " page", k: "instead of a hundred threads" },
    ],
    cta: "Build an Executive Assistant",
    dark: true,
  },
];

/** One pinned story card that recedes as the next slides over it. */
function StoryCard({ story, index }: { story: Story; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const dim = useTransform(scrollYProgress, [0, 1], [1, 0.55]);

  const ink = story.dark;
  return (
    <div ref={ref} className="sticky top-[10vh] mb-8" style={{ zIndex: index + 1 }}>
      <motion.article
        style={{ scale, opacity: dim }}
        className={`origin-top overflow-hidden rounded-[2rem] border shadow-[0_40px_100px_-40px_rgba(0,0,0,0.4)] ${
          ink ? "border-neutral-800 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-950"
        }`}
      >
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* Story copy */}
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${ink ? "text-neutral-500" : "text-neutral-400"}`}>
              {story.tag}
            </p>
            <h3 className="mt-3 text-balance text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              {story.headline}
            </h3>
            <dl className="mt-7 space-y-5">
              <div>
                <dt className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${ink ? "text-neutral-500" : "text-neutral-400"}`}>
                  Situation
                </dt>
                <dd className={`mt-1.5 text-[15px] leading-relaxed ${ink ? "text-neutral-300" : "text-neutral-600"}`}>
                  {story.situation}
                </dd>
              </div>
              <div>
                <dt className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${ink ? "text-neutral-500" : "text-neutral-400"}`}>
                  Task
                </dt>
                <dd className={`mt-1.5 text-[15px] leading-relaxed ${ink ? "text-neutral-300" : "text-neutral-600"}`}>
                  {story.task}
                </dd>
              </div>
            </dl>
            <div className="mt-8">
              <Magnetic>
                <a
                  href="/signup"
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold transition-transform duration-200 hover:scale-[1.03] ${
                    ink ? "bg-white text-neutral-950" : "bg-neutral-950 text-white"
                  }`}
                >
                  {story.cta} <span aria-hidden>→</span>
                </a>
              </Magnetic>
            </div>
          </div>

          {/* Action trace + results */}
          <div className="flex flex-col justify-between gap-7">
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${ink ? "text-neutral-500" : "text-neutral-400"}`}>
                Action — watch it work
              </p>
              <div className="relative mt-3">
                <span
                  aria-hidden
                  className={`absolute bottom-2 left-[9px] top-2 w-px ${ink ? "bg-neutral-800" : "bg-neutral-200"}`}
                />
                <motion.ul
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-60px" }}
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
                  className="space-y-1.5"
                >
                  {story.actions.map((a, i) => (
                    <motion.li
                      key={a}
                      variants={{
                        hidden: { opacity: 0, x: 16 },
                        show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE } },
                      }}
                      className="relative flex items-center gap-3 pl-0"
                    >
                      <span
                        className={`z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                          ink ? "bg-neutral-800 text-neutral-300" : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-[13px] ${
                          ink ? "border-neutral-800 bg-neutral-900/60 text-neutral-200" : "border-neutral-100 bg-neutral-50/80 text-neutral-600"
                        }`}
                      >
                        {a}
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            </div>

            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${ink ? "text-neutral-500" : "text-neutral-400"}`}>
                Result
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {story.results.map((r) => (
                  <div
                    key={r.k}
                    className={`rounded-2xl border px-3 py-3 ${ink ? "border-neutral-800 bg-neutral-900/60" : "border-neutral-200 bg-neutral-50/70"}`}
                  >
                    <p className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
                      <CountUp to={r.v} suffix={r.suffix} duration={1.2} />
                    </p>
                    <p className={`mt-1 text-[11px] leading-snug ${ink ? "text-neutral-400" : "text-neutral-400"}`}>{r.k}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

export function UseCases() {
  return (
    <section id="use-cases" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="Meet the workforce"
        title="One specialised [AI Employee] for every repetitive job."
        description="Six stories, told the way work actually happens: the situation, the task, the actions taken, the result delivered."
      />

      <div className="mt-16">
        {STORIES.map((story, i) => (
          <StoryCard key={story.tag} story={story} index={i} />
        ))}
      </div>

      <Reveal className="text-center">
        <p className="text-[12px] text-neutral-400">
          Illustrative scenarios — they show how Taurus AI Employees are designed to work, not customer claims.
        </p>
      </Reveal>
    </section>
  );
}

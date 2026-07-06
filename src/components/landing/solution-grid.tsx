"use client";

/**
 * Solution grid (Premium Landing v2).
 *
 * The Taurus operating system as a connected module grid: eight premium cards
 * over a faint blueprint grid, staggering into place like an OS booting up.
 */

import { RevealGroup, RevealItem, SectionHeading } from "@/components/landing/reveal";

const MODULES: { title: string; body: string; featured?: boolean }[] = [
  {
    title: "Hiring Studio",
    body: "Bring on an AI Employee for a role in minutes — guided, calm, no technical setup.",
    featured: true,
  },
  {
    title: "Employee DNA",
    body: "Mission, responsibilities, communication style, boundaries, and escalation rules.",
    featured: true,
  },
  {
    title: "Knowledge Vault",
    body: "Approved company knowledge, assigned per Employee. Grounded answers only.",
    featured: true,
  },
  {
    title: "Model Hub",
    body: "Route every job to the right AI model for quality, cost, speed, and privacy.",
    featured: true,
  },
  {
    title: "Channels",
    body: "Deploy to website, messaging, email, and voice-ready surfaces from one place.",
  },
  {
    title: "Unified Inbox",
    body: "Every conversation across every channel in one operational command center.",
  },
  {
    title: "Human Handoff",
    body: "Escalate to people the moment judgment is required. Nothing falls through.",
  },
  {
    title: "Audit & Usage",
    body: "Every action recorded. Every cost visible. Governance built in from day one.",
  },
];

export function SolutionGrid() {
  return (
    <section className="relative py-24 sm:py-32" id="platform">
      {/* Blueprint grid backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="The operating system"
          title="Everything your AI Employees need, in one operating system."
          description="One roster. One set of rules. One place where AI work is hired, trained, deployed, and governed."
        />

        <RevealGroup className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module) => (
            <RevealItem key={module.title}>
              <div
                className={`group relative h-full overflow-hidden rounded-2xl border p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 ${
                  module.featured
                    ? "border-white/[0.14] bg-white/[0.05] hover:border-white/30 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9),0_0_40px_rgba(255,255,255,0.05)]"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                {/* Corner glow on hover. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/[0.06] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                />
                <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.05]">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-sm bg-white/70 transition-transform duration-300 group-hover:rotate-45"
                  />
                </div>
                <h3 className="text-[15px] font-semibold text-taurus-text">{module.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-taurus-faint">{module.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

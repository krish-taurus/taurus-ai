"use client";

/**
 * Hiring Studio section (Sprint 020) — the four-step "how it works".
 *
 * A large, numbered four-step walkthrough on white. Each step reveals on scroll
 * with a big index numeral, a title, a description, and a small inline diagram —
 * "large texts font describing the process." Anchor: #how-it-works.
 */

import { Reveal, RevealGroup, RevealItem } from "@/components/landing/reveal";
import { SectionHeadingLight } from "@/components/landing/light/section-heading-light";

const STEPS = [
  {
    n: "01",
    title: "Choose a role",
    body: "Start from a template — Receptionist, Sales, Support, and more. Each one arrives pre-shaped so you are never staring at a blank page.",
    art: (
      <div className="flex flex-wrap gap-1.5">
        {["Receptionist", "Sales", "Support"].map((r, i) => (
          <span
            key={r}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
              i === 1
                ? "bg-neutral-900 text-white"
                : "border border-neutral-200 text-neutral-500"
            }`}
          >
            {r}
          </span>
        ))}
      </div>
    ),
  },
  {
    n: "02",
    title: "Shape the DNA",
    body: "The template pre-fills the Employee DNA — mission, responsibilities, communication style, boundaries, and escalation rules. Edit in plain language. No technical setup.",
    art: (
      <div className="space-y-1.5">
        {["Mission", "Boundaries", "Escalation"].map((k, i) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-16 text-[10px] uppercase tracking-wide text-neutral-400">{k}</span>
            <span
              className={`h-1.5 rounded-full bg-neutral-300 ${["w-16", "w-10", "w-14"][i]}`}
            />
          </div>
        ))}
      </div>
    ),
  },
  {
    n: "03",
    title: "Add your knowledge",
    body: "Point the Knowledge Vault at your docs, policies, and pages. Your AI Employee answers from what your company actually knows — grounded, not guessed.",
    art: (
      <div className="flex items-center gap-1.5">
        {["PDF", "Docs", "URL"].map((k) => (
          <span
            key={k}
            className="rounded-md border border-neutral-200 px-2 py-1 text-[10px] font-medium text-neutral-500"
          >
            {k}
          </span>
        ))}
        <span aria-hidden className="text-neutral-300">→</span>
        <span className="rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white">
          Vault
        </span>
      </div>
    ),
  },
  {
    n: "04",
    title: "Test, then deploy",
    body: "Chat with your Employee to see it work, then deploy to your website, WhatsApp, SMS, or phone with the managed Model Hub picking the right brain for every job.",
    art: (
      <div className="flex flex-wrap gap-1.5">
        {["Website", "WhatsApp", "SMS", "Phone"].map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white"
          >
            <span aria-hidden className="h-1 w-1 rounded-full bg-white" />
            {c}
          </span>
        ))}
      </div>
    ),
  },
];

export function HiringStudioSection() {
  return (
    <section className="relative bg-neutral-50 py-24 sm:py-32" id="how-it-works">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeadingLight
          eyebrow="The Hiring Studio"
          title="From idea to deployed AI Employee in four steps."
          description="No models to wire, no configuration to tune, no infrastructure to run. Just describe the job and put it to work."
        />

        <RevealGroup className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {STEPS.map((step) => (
            <RevealItem key={step.n}>
              <div className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-8">
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl font-semibold tracking-tight text-neutral-200">
                    {step.n}
                  </span>
                  <h3 className="text-2xl font-semibold text-neutral-900">{step.title}</h3>
                </div>
                <p className="mt-4 text-base leading-relaxed text-neutral-600">{step.body}</p>
                <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  {step.art}
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-12 text-center">
          <a
            href="#use-cases"
            className="text-sm font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900"
          >
            See it across five kinds of work ↓
          </a>
        </Reveal>
      </div>
    </section>
  );
}

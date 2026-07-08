"use client";

/**
 * Model Hub section (Sprint 020) — "any model, no lock-in."
 *
 * Managed by default (Taurus picks the right brain and the budget-tier model for
 * everyday work), with the option to bring your own provider keys. Presented as a
 * dark anchor band (the "dark colour to highlight") within the white page.
 */

import { Reveal, RevealGroup, RevealItem } from "@/components/landing/reveal";
import { IconCpu } from "@/components/landing/light/illustrations";

const POINTS = [
  {
    title: "Managed by default",
    body: "Taurus routes each job to a cost-appropriate brain and defaults new Employees to an efficient model — no tuning required.",
  },
  {
    title: "Bring your own keys",
    body: "On Growth and Scale, connect your own model provider keys. Your usage runs on your account, your terms.",
  },
  {
    title: "No lock-in",
    body: "Switch the brain behind any Employee without rewriting its DNA, knowledge, or channels. Your workforce is portable.",
  },
];

export function ModelHubSection() {
  return (
    <section className="relative py-24 sm:py-32" id="model-hub">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="overflow-hidden rounded-[2rem] border border-neutral-900 bg-neutral-900 px-6 py-16 text-white sm:px-14 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-neutral-900">
                <IconCpu className="h-7 w-7" />
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
                Model Hub
              </p>
              <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                Any model. No lock-in.
              </h2>
              <p className="mt-5 text-pretty text-lg leading-relaxed text-neutral-300">
                Choose the right brain for every job. Start fully managed, bring your own provider
                keys when you are ready, and switch anytime without rebuilding a thing.
              </p>
            </div>

            <RevealGroup className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
              {POINTS.map((point) => (
                <RevealItem key={point.title}>
                  <div className="h-full rounded-2xl border border-white/15 bg-white/[0.04] p-6">
                    <h3 className="text-lg font-semibold text-white">{point.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-300">{point.body}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

"use client";

/**
 * Positioning section (Sprint 020).
 *
 * The core contrast: the old way takes "a quarter and a deployment team"; Taurus
 * takes "an afternoon." A two-column before/after on white, large type, dark ink
 * on the Taurus side to make it the visual anchor.
 */

import { Reveal } from "@/components/landing/reveal";
import { IconCheck } from "@/components/landing/light/illustrations";

const OLD_WAY = [
  "Scope a bespoke automation project",
  "Wire up models, tooling, and glue code",
  "Stand up infrastructure and channels",
  "Wait a quarter for a deployment team",
];

const TAURUS_WAY = [
  "Pick a role and a starting template",
  "Add your knowledge, shape the DNA",
  "Test in chat, then deploy to a channel",
  "Live this afternoon — no engineers",
];

export function PositioningSection() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
            Why Taurus
          </p>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl md:text-[3.25rem] md:leading-[1.06]">
            Standing up an AI workforce used to take{" "}
            <span className="text-neutral-400">a quarter and a deployment team.</span> Now it takes{" "}
            <span className="underline decoration-neutral-900 decoration-4 underline-offset-8">
              an afternoon.
            </span>
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-neutral-200 bg-neutral-50 p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-400">
                The old way
              </p>
              <p className="mt-3 text-2xl font-semibold text-neutral-500">A quarter</p>
              <ul className="mt-6 space-y-3">
                {OLD_WAY.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-neutral-500">
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300"
                    />
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-3xl border border-neutral-900 bg-neutral-900 p-8 text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-400">
                With Taurus
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">An afternoon</p>
              <ul className="mt-6 space-y-3">
                {TAURUS_WAY.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-white" />
                    <span className="text-base text-neutral-100">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

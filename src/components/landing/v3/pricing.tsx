"use client";

/**
 * Landing v3 — pricing (Sprint 055).
 *
 * Reads the code-authoritative plans catalog (no hard-coded prices, same rule
 * as the in-app plans page) and adds the enterprise conversation path. Starter
 * is free with no card — the "start with one employee" promise is real.
 */

import Link from "next/link";
import { PLANS_IN_ORDER } from "@/modules/billing/plans";
import { Magnetic, Reveal, RevealGroup, RevealItem, SectionHeading } from "@/components/landing/v3/motion";

export function Pricing() {
  return (
    <section id="pricing" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="Pricing"
        title="Start with one employee. [Scale to a workforce.]"
        description="Simple monthly plans. Start free, upgrade when the work grows — every plan includes the full platform."
      />

      <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3">
        {PLANS_IN_ORDER.map((plan, i) => {
          const featured = i === 1;
          return (
            <RevealItem key={plan.id}>
              <div
                className={`relative flex h-full flex-col rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1.5 ${
                  featured
                    ? "bg-neutral-950 text-white shadow-[0_40px_90px_-36px_rgba(0,0,0,0.55)]"
                    : "border border-neutral-200 bg-white shadow-taurus-sm"
                }`}
              >
                {featured ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-950 shadow">
                    Most popular
                  </span>
                ) : null}
                <h3 className={`text-lg font-semibold ${featured ? "text-white" : "text-neutral-950"}`}>{plan.name}</h3>
                <p className={`mt-1 min-h-[40px] text-[13px] leading-relaxed ${featured ? "text-neutral-400" : "text-neutral-500"}`}>
                  {plan.tagline}
                </p>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className={`text-5xl font-semibold tracking-tight ${featured ? "text-white" : "text-neutral-950"}`}>
                    {plan.isFree ? "Free" : `$${plan.monthlyPriceUsd}`}
                  </span>
                  {!plan.isFree && <span className={`text-sm ${featured ? "text-neutral-500" : "text-neutral-400"}`}>/ month</span>}
                </p>
                <ul className={`mt-6 flex-1 space-y-2.5 text-[13px] ${featured ? "text-neutral-300" : "text-neutral-600"}`}>
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2.5">
                      <svg viewBox="0 0 12 12" className="mt-1 h-3 w-3 shrink-0" aria-hidden>
                        <path
                          d="M2 6.2 L4.8 9 L10 3.4"
                          className={featured ? "stroke-white" : "stroke-neutral-950"}
                          strokeWidth={1.6}
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>
                <Magnetic className="mt-7 block">
                  <Link
                    href="/signup"
                    className={`block w-full rounded-full py-3.5 text-center text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] ${
                      featured ? "bg-white text-neutral-950" : "bg-neutral-950 text-white"
                    }`}
                  >
                    {plan.isFree ? "Start free" : `Start with ${plan.name}`}
                  </Link>
                </Magnetic>
              </div>
            </RevealItem>
          );
        })}
      </RevealGroup>

      <Reveal className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-neutral-200 bg-neutral-50/70 px-7 py-6">
          <div>
            <h3 className="text-base font-semibold text-neutral-950">Enterprise</h3>
            <p className="mt-1 text-[13px] text-neutral-500">
              Governance, private integrations, custom deployment and a workforce plan shaped to your organisation.
            </p>
          </div>
          <a
            href="#contact"
            className="rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-800 transition-colors duration-200 hover:border-neutral-900"
          >
            Talk to sales
          </a>
        </div>
      </Reveal>
    </section>
  );
}

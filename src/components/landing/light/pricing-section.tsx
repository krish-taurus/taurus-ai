"use client";

/**
 * Pricing section (Sprint 020).
 *
 * Reads the code-authoritative plans catalog (PLANS_IN_ORDER) — no price is
 * hard-coded here. The plans module is a pure, secret-free module safe to import
 * into a client component. CTAs route to /signup. Anchor: #pricing.
 */

import Link from "next/link";
import { RevealGroup, RevealItem } from "@/components/landing/reveal";
import { SectionHeadingLight } from "@/components/landing/light/section-heading-light";
import { IconCheck } from "@/components/landing/light/illustrations";
import { PLANS_IN_ORDER } from "@/modules/billing/plans";

export function PricingSection() {
  return (
    <section className="relative bg-neutral-50 py-24 sm:py-32" id="pricing">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeadingLight
          eyebrow="Pricing"
          title="Start free. Grow when you do."
          description="Every plan includes the Hiring Studio, Employee DNA, the Knowledge Vault, and the Model Hub. Upgrade for more Employees, more knowledge, and more interactions."
        />

        <RevealGroup className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS_IN_ORDER.map((plan) => {
            const featured = plan.id === "growth";
            return (
              <RevealItem key={plan.id}>
                <div
                  className={`flex h-full flex-col rounded-3xl border p-8 ${
                    featured
                      ? "border-neutral-900 bg-neutral-900 text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3
                      className={`text-xl font-semibold ${featured ? "text-white" : "text-neutral-900"}`}
                    >
                      {plan.name}
                    </h3>
                    {featured ? (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-900">
                        Most popular
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span
                      className={`text-5xl font-semibold tracking-tight ${featured ? "text-white" : "text-neutral-900"}`}
                    >
                      {plan.isFree ? "Free" : `$${plan.monthlyPriceUsd}`}
                    </span>
                    {plan.isFree ? null : (
                      <span className={`text-sm ${featured ? "text-neutral-400" : "text-neutral-500"}`}>
                        /month
                      </span>
                    )}
                  </div>
                  <p className={`mt-3 text-sm ${featured ? "text-neutral-300" : "text-neutral-600"}`}>
                    {plan.tagline}
                  </p>

                  <ul className="mt-7 space-y-3">
                    {plan.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2.5">
                        <IconCheck
                          className={`mt-0.5 h-5 w-5 shrink-0 ${featured ? "text-white" : "text-neutral-900"}`}
                        />
                        <span
                          className={`text-sm ${featured ? "text-neutral-200" : "text-neutral-600"}`}
                        >
                          {highlight}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 pt-2">
                    <Link
                      href="/signup"
                      className={`block w-full rounded-xl px-6 py-3.5 text-center text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        featured
                          ? "bg-white text-neutral-900"
                          : "bg-neutral-900 text-white"
                      }`}
                    >
                      {plan.isFree ? "Start free" : `Choose ${plan.name}`}
                    </Link>
                  </div>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}

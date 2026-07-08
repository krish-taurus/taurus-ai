"use client";

/**
 * Final CTA (Sprint 020, light).
 *
 * The closing ask on a bright surface: oversized headline, the hire moment, and
 * dual CTAs to the real /signup and /login routes.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "@/components/landing/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;
const CTA_CHANNELS = ["Website", "WhatsApp", "SMS", "Phone"];

export function FinalCtaLight() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36" id="get-started">
      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-balance text-5xl font-semibold tracking-tight text-neutral-900 sm:text-6xl">
              Hire your first AI Employee today.
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-neutral-600">
              Start with one role. Add your knowledge. Shape the DNA. Deploy across your channels — no
              engineers, no lock-in.
            </p>
          </Reveal>

          <Reveal delay={0.15} className="mt-12">
            <div className="mx-auto w-fit">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.7, ease: EASE }}
                className="rounded-2xl border border-neutral-200 bg-white px-8 py-5 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.4)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-sm font-semibold text-white">
                    M
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-semibold text-neutral-900">
                      Maya — AI Sales Assistant
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <span aria-hidden className="h-1 w-1 rounded-full bg-neutral-900" />
                      Hired · DNA published · Knowledge assigned
                    </span>
                  </span>
                </div>
              </motion.div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {CTA_CHANNELS.map((channel, index) => (
                  <motion.span
                    key={channel}
                    initial={{ opacity: 0.3, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.45, delay: 0.45 + index * 0.14, ease: EASE }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-[11px] text-white"
                  >
                    <span aria-hidden className="h-1 w-1 rounded-full bg-white" />
                    {channel}
                  </motion.span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.25} className="mt-12">
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-xl bg-neutral-900 px-8 py-4 text-base font-semibold text-white transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] sm:w-auto"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="w-full rounded-xl border border-neutral-300 bg-white px-8 py-4 text-base font-semibold text-neutral-900 transition-colors duration-200 hover:border-neutral-900 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-sm text-neutral-400">
              Start on the free Starter plan — no card required.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

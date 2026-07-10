"use client";

/**
 * Landing v3 — contact (Sprint 055).
 *
 * The demo / sales conversation path. The form composes a pre-filled email to
 * the team (no backend inbox exists yet, so this is honest: submit opens the
 * visitor's mail client with everything written), and the direct phone and
 * email are front and centre for people who'd rather just reach out.
 */

import { useState, type FormEvent } from "react";
import { Reveal, SectionHeading } from "@/components/landing/v3/motion";

const CONTACT_EMAIL = "krishbhargav@thetaurus.ai";
const CONTACT_PHONE_DISPLAY = "+91 63634 02404";
const CONTACT_PHONE_TEL = "+916363402404";

export function Contact() {
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "");
    const company = String(data.get("company") ?? "");
    const email = String(data.get("email") ?? "");
    const message = String(data.get("message") ?? "");
    const subject = encodeURIComponent(`Demo request — ${company || name}`);
    const body = encodeURIComponent(
      `Hi Taurus AI team,\n\n${message}\n\n— ${name}${company ? `\n${company}` : ""}${email ? `\n${email}` : ""}`,
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <section id="contact" className="relative scroll-mt-24 bg-neutral-50/60 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Contact"
          title="Talk to a human [about your AI workforce.]"
          description="Tell us what you want to automate — we'll show you the employee that does it. Or skip the form and reach us directly."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Direct lines */}
          <Reveal>
            <div className="flex h-full flex-col gap-4">
              <a
                href={`tel:${CONTACT_PHONE_TEL}`}
                className="group flex items-center gap-5 rounded-3xl border border-neutral-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-taurus-lift"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-950" aria-hidden>
                  <svg viewBox="0 0 20 20" className="h-5 w-5">
                    <path
                      d="M4 3.5 C4 3.5 6.5 3 7 5 L7.8 7.4 C8 8 7.7 8.6 7.2 9 L6.2 9.8 C7.2 12 9 13.8 11.2 14.8 L12 13.8 C12.4 13.3 13 13 13.6 13.2 L16 14 C18 14.5 16.5 17 16.5 17 C15.5 18 13.5 18 11.5 17 C7.5 15 5 12.5 3 8.5 C2 6.5 3 4.5 4 3.5 Z"
                      className="fill-white"
                    />
                  </svg>
                </span>
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                    Call or WhatsApp
                  </span>
                  <span className="block text-lg font-semibold text-neutral-950 transition-colors group-hover:text-neutral-700">
                    {CONTACT_PHONE_DISPLAY}
                  </span>
                </span>
              </a>

              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group flex items-center gap-5 rounded-3xl border border-neutral-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-taurus-lift"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-950" aria-hidden>
                  <svg viewBox="0 0 20 20" className="h-5 w-5">
                    <rect x={2.5} y={4.5} width={15} height={11} rx={2} className="fill-none stroke-white" strokeWidth={1.5} />
                    <path d="M3.5 6 L10 11 L16.5 6" className="fill-none stroke-white" strokeWidth={1.5} />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">
                    Email us
                  </span>
                  <span className="block truncate text-lg font-semibold text-neutral-950 transition-colors group-hover:text-neutral-700">
                    {CONTACT_EMAIL}
                  </span>
                </span>
              </a>

              <div className="flex-1 rounded-3xl bg-neutral-950 p-6 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
                  What happens next
                </p>
                <ul className="mt-4 space-y-3 text-[14px] text-neutral-300">
                  <li className="flex gap-3">
                    <span className="font-semibold text-white">1.</span> A short call about the work you want off your team&rsquo;s plate
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-white">2.</span> A live walkthrough with an AI Employee shaped to your case
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-white">3.</span> You deploy on the free plan — upgrade only when it earns it
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>

          {/* Form */}
          <Reveal delay={0.12}>
            <form
              onSubmit={onSubmit}
              className="rounded-3xl border border-neutral-200 bg-white p-7 shadow-taurus sm:p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                    Your name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    required
                    autoComplete="name"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 focus:bg-white"
                    placeholder="Priya Sharma"
                  />
                </div>
                <div>
                  <label htmlFor="contact-company" className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                    Company
                  </label>
                  <input
                    id="contact-company"
                    name="company"
                    autoComplete="organization"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 focus:bg-white"
                    placeholder="Acme Industries"
                  />
                </div>
              </div>
              <div className="mt-5">
                <label htmlFor="contact-email" className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                  Work email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 focus:bg-white"
                  placeholder="priya@acme.com"
                />
              </div>
              <div className="mt-5">
                <label htmlFor="contact-message" className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                  What would you like to automate?
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  rows={4}
                  required
                  className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900 focus:bg-white"
                  placeholder="e.g. We get ~200 WhatsApp enquiries a day and reply too slowly…"
                />
              </div>
              <button
                type="submit"
                className="mt-6 w-full rounded-full bg-neutral-950 py-4 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                Book a personalised demo
              </button>
              <p className="mt-3 text-center text-[12px] text-neutral-400" aria-live="polite">
                {sent
                  ? "Your email draft is ready — just press send."
                  : "Opens your email client with everything pre-filled. No spam, ever."}
              </p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

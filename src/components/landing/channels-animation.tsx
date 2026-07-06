"use client";

/**
 * Channels section (Premium Landing v2).
 *
 * A deployment grid lighting up channel by channel. Careful copy: web is
 * available now; messaging and voice are described as built-for / voice-ready.
 */

import { RevealGroup, RevealItem, SectionHeading, Reveal } from "@/components/landing/reveal";

const CHANNELS: { name: string; note: string; live?: boolean }[] = [
  { name: "Website Widget", note: "One line of code", live: true },
  { name: "Hosted Chat", note: "Shareable link", live: true },
  { name: "Iframe", note: "Embed anywhere", live: true },
  { name: "Public API", note: "Build on top", live: true },
  { name: "WhatsApp", note: "Messaging-ready" },
  { name: "SMS", note: "Messaging-ready" },
  { name: "Email", note: "Messaging-ready" },
  { name: "Phone Calls", note: "Voice-ready" },
  { name: "Voice-ready", note: "Built for speech" },
  { name: "More channels", note: "Coming soon" },
];

export function ChannelsAnimation() {
  return (
    <section className="relative py-24 sm:py-32" id="channels">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Channels"
          title="Deploy AI Employees everywhere your customers talk."
          description="One Employee. Many channels. Same DNA, same knowledge, same governance."
        />

        <RevealGroup className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CHANNELS.map((channel) => (
            <RevealItem key={channel.name}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-white/25">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
                <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full ${channel.live ? "bg-white" : "bg-white/35"} ${channel.live ? "landing-pulse" : ""}`}
                  />
                </div>
                <p className="text-sm font-semibold text-taurus-text">{channel.name}</p>
                <p className="mt-1 text-[11px] text-taurus-faint">{channel.note}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.1} className="mx-auto mt-10 max-w-xl text-center">
          <p className="text-sm text-taurus-faint">
            Built for web, messaging, and voice-ready deployments — governed from one place.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

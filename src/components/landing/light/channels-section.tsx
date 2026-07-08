"use client";

/**
 * Channels section (Sprint 020).
 *
 * One AI Employee, everywhere your customers are: the website widget, WhatsApp +
 * SMS, and phone (voice-ready). Same DNA, same knowledge, same governance across
 * every channel. Large channel cards on white with dark iconography.
 */

import { RevealGroup, RevealItem } from "@/components/landing/reveal";
import { SectionHeadingLight } from "@/components/landing/light/section-heading-light";
import {
  IconGlobe,
  IconMessage,
  IconPhone,
} from "@/components/landing/light/illustrations";

const CHANNELS = [
  {
    icon: IconGlobe,
    name: "Website",
    body: "Drop a single snippet on your site and your AI Employee greets, qualifies, and answers visitors in real time.",
    tag: "Web widget",
  },
  {
    icon: IconMessage,
    name: "WhatsApp + SMS",
    body: "Meet customers in the messaging apps they already use. Conversations continue across sessions with full context.",
    tag: "Messaging",
  },
  {
    icon: IconPhone,
    name: "Phone",
    body: "Voice-ready from the same DNA — answer calls, take intake, and route to a human when the boundaries say so.",
    tag: "Voice-ready",
  },
];

export function ChannelsSection() {
  return (
    <section className="relative py-24 sm:py-32" id="channels">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeadingLight
          eyebrow="Channels"
          title="One Employee. Every channel."
          description="Same DNA, same knowledge, same governance — whether the conversation happens on your website, in a message, or over the phone."
        />

        <RevealGroup className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
              <RevealItem key={channel.name}>
                <div className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-8 transition-shadow duration-300 hover:shadow-[0_30px_80px_-50px_rgba(0,0,0,0.45)]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                    <Icon className="h-7 w-7" />
                  </div>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    {channel.tag}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-neutral-900">{channel.name}</h3>
                  <p className="mt-3 text-base leading-relaxed text-neutral-600">{channel.body}</p>
                </div>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}

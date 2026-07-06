"use client";

/**
 * Unified Inbox section (Premium Landing v2).
 *
 * An operational command center: conversations from every channel appear one by
 * one with live status transitions — needs human, assigned, resolved.
 */

import { motion } from "framer-motion";
import { Reveal, SectionHeading } from "@/components/landing/reveal";

const EASE = [0.16, 1, 0.3, 1] as const;

const CONVERSATIONS: {
  channel: string;
  from: string;
  preview: string;
  status: string;
  emphasis?: boolean;
}[] = [
  {
    channel: "Website",
    from: "Website visitor",
    preview: "Can you walk me through your pricing tiers?",
    status: "Resolved",
  },
  {
    channel: "WhatsApp",
    from: "WhatsApp lead",
    preview: "We'd like a demo for a 40-person team.",
    status: "Assigned to Sarah",
    emphasis: true,
  },
  {
    channel: "Email",
    from: "Email question",
    preview: "Does the contract cover multiple regions?",
    status: "Needs human",
    emphasis: true,
  },
  {
    channel: "Voice",
    from: "Voice transcript",
    preview: "Caller asked about onboarding timelines…",
    status: "Resolved",
  },
];

export function InboxAnimation() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Unified Inbox"
          title="Every conversation. One command center."
          description="Monitor AI Employee conversations, review outcomes, add notes, request human handoff, and resolve work from one operational inbox."
        />

        <Reveal className="mt-16">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#080808]">
            {/* Window chrome */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
              <div className="flex items-center gap-2" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-taurus-faint">
                Unified Inbox
              </p>
              <span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] text-taurus-faint">
                4 open
              </span>
            </div>

            <div className="divide-y divide-white/[0.05]">
              {CONVERSATIONS.map((conversation, index) => (
                <motion.div
                  key={conversation.from}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: 0.15 + index * 0.15, ease: EASE }}
                  className="flex items-center gap-4 px-5 py-4 transition-colors duration-300 hover:bg-white/[0.02]"
                >
                  <span className="hidden w-20 shrink-0 rounded-md border border-white/10 px-2 py-1 text-center text-[10px] font-medium text-taurus-faint sm:block">
                    {conversation.channel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-taurus-text">
                      {conversation.from}
                    </p>
                    <p className="truncate text-xs text-taurus-faint">{conversation.preview}</p>
                  </div>
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: 0.55 + index * 0.15, duration: 0.4, ease: EASE }}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                      conversation.emphasis
                        ? "border-white/30 bg-white/[0.07] text-taurus-text"
                        : "border-white/12 text-taurus-sub"
                    }`}
                  >
                    {conversation.status}
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

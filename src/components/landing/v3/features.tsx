"use client";

/**
 * Landing v3 — the whole platform (Sprint 055).
 *
 * Every real surface of the product in one bento wall — nothing invented,
 * nothing left out: Hiring Studio, Employee DNA, Brain, Knowledge Vault +
 * connectors, chat, channels, voice, workflows + canvas, approvals, triggers,
 * Marketplace + earnings, Model Hub, performance reviews, usage, audit, roles,
 * billing, widget embeds and QR reach. Larger cards get a live micro-visual.
 */

import { RevealGroup, RevealItem, SectionHeading, Reveal, SecondaryCta } from "@/components/landing/v3/motion";

interface Feature {
  title: string;
  body: string;
  span?: string;
  visual?: "dna" | "vault" | "canvas" | "market";
}

const FEATURES: Feature[] = [
  {
    title: "Hiring Studio",
    body: "A guided path from role to working AI Employee — pick a role, shape it, test it, deploy it.",
    span: "md:col-span-2",
    visual: "dna",
  },
  {
    title: "Employee DNA",
    body: "Structured identity instead of fragile instructions: goals, personality, boundaries, escalation rules, working hours.",
  },
  {
    title: "Knowledge Vault",
    body: "Files, pages, text, URLs, Google Drive, SharePoint, cloud storage and live databases — private per organisation, with scheduled re-sync.",
    span: "md:col-span-2",
    visual: "vault",
  },
  {
    title: "Employee Chat & Brain",
    body: "Talk to any employee, inspect how it thinks, and see which knowledge grounded each answer.",
  },
  {
    title: "Workflows & visual canvas",
    body: "Automate real processes with branching, hand-offs and sub-workflows — build as a list or drag and drop on a canvas.",
    span: "md:col-span-2",
    visual: "canvas",
  },
  {
    title: "Triggers",
    body: "Run workflows manually, on a webhook, on a schedule, or when a message arrives on a channel.",
  },
  {
    title: "Human approvals",
    body: "Workflows pause at approval steps until a person says go — with the full context attached.",
  },
  {
    title: "Every channel",
    body: "Website chat, WhatsApp, SMS, email, Telegram, Messenger, Instagram, Slack, Microsoft Teams and phone calls.",
  },
  {
    title: "Voice",
    body: "Your AI Employee answers the phone — greets, resolves, and hands off like a professional.",
  },
  {
    title: "AI Employee Marketplace",
    body: "Publish proven employees, browse a public directory with filters, and hire ready-made specialists.",
    span: "md:col-span-2",
    visual: "market",
  },
  {
    title: "Marketplace earnings",
    body: "Sell your best employees: track earnings, requests and payouts from one place.",
  },
  {
    title: "Model Hub",
    body: "Taurus-managed models or bring your own keys — assign the right model to each employee.",
  },
  {
    title: "Performance Reviews",
    body: "Scheduled scorecards grade real transcripts on groundedness, boundaries and tone.",
  },
  {
    title: "Usage & cost control",
    body: "Interaction metering, plan quotas and per-model cost visibility — no surprise bills.",
  },
  {
    title: "Audit log",
    body: "Every action, by human or AI Employee, recorded and reviewable.",
  },
  {
    title: "Roles & permissions",
    body: "Owners, managers and viewers — each with exactly the access they need.",
  },
  {
    title: "Website widget & embeds",
    body: "Drop a script tag on your site, or share a public chat page for any employee.",
  },
  {
    title: "QR reach",
    body: "Put an employee on a poster, a package or a business card with a scannable code.",
  },
];

/* Tiny monochrome micro-visuals for the feature bento's large cards. */
function MicroVisual({ kind }: { kind: NonNullable<Feature["visual"]> }) {
  if (kind === "dna") {
    return (
      <svg viewBox="0 0 220 64" className="h-14 w-full" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x={8 + i * 44} y={i % 2 ? 10 : 26} width={36} height={20} rx={7} className="fill-neutral-100 stroke-neutral-300" strokeWidth={1} />
            {i < 4 && <path d={`M${44 + i * 44} ${i % 2 ? 20 : 36} L${52 + i * 44} ${i % 2 ? 36 : 20}`} className="stroke-neutral-400 landing-dash" strokeWidth={1.2} fill="none" />}
          </g>
        ))}
      </svg>
    );
  }
  if (kind === "vault") {
    return (
      <svg viewBox="0 0 220 64" className="h-14 w-full" aria-hidden>
        {[14, 52, 90, 128].map((x, i) => (
          <g key={x}>
            <rect x={x} y={8} width={28} height={16} rx={5} className="fill-neutral-100 stroke-neutral-300" strokeWidth={1} />
            <path d={`M${x + 14} 24 L${x + 14} 34 L 180 34 L 180 40`} className="stroke-neutral-300 landing-dash-slow" strokeWidth={1.2} fill="none" />
          </g>
        ))}
        <rect x={158} y={40} width={44} height={18} rx={7} className="fill-neutral-950" />
        <circle cx={180} cy={49} r={3} className="fill-white landing-blink" />
      </svg>
    );
  }
  if (kind === "canvas") {
    return (
      <svg viewBox="0 0 220 64" className="h-14 w-full" aria-hidden>
        <rect x={10} y={22} width={40} height={20} rx={7} className="fill-neutral-950" />
        <rect x={90} y={6} width={40} height={20} rx={7} className="fill-neutral-100 stroke-neutral-300" strokeWidth={1} />
        <rect x={90} y={38} width={40} height={20} rx={7} className="fill-neutral-100 stroke-neutral-300" strokeWidth={1} />
        <rect x={170} y={22} width={40} height={20} rx={7} className="fill-neutral-100 stroke-neutral-300" strokeWidth={1} />
        <path d="M50 32 C 70 32, 70 16, 90 16" className="stroke-neutral-400 landing-dash" strokeWidth={1.2} fill="none" />
        <path d="M50 32 C 70 32, 70 48, 90 48" className="stroke-neutral-400 landing-dash" strokeWidth={1.2} fill="none" />
        <path d="M130 16 C 150 16, 150 32, 170 32" className="stroke-neutral-300" strokeWidth={1.2} fill="none" />
        <path d="M130 48 C 150 48, 150 32, 170 32" className="stroke-neutral-300" strokeWidth={1.2} fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 220 64" className="h-14 w-full" aria-hidden>
      {[10, 82, 154].map((x, i) => (
        <g key={x}>
          <rect x={x} y={10} width={56} height={44} rx={9} className={i === 1 ? "fill-neutral-950" : "fill-neutral-100 stroke-neutral-300"} strokeWidth={1} />
          <circle cx={x + 14} cy={24} r={5} className={i === 1 ? "fill-white" : "fill-neutral-300"} />
          <rect x={x + 8} y={34} width={40} height={4} rx={2} className={i === 1 ? "fill-neutral-600" : "fill-neutral-200"} />
          <rect x={x + 8} y={42} width={28} height={4} rx={2} className={i === 1 ? "fill-neutral-700" : "fill-neutral-200"} />
        </g>
      ))}
    </svg>
  );
}

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <SectionHeading
        eyebrow="The whole platform"
        title="Everything a workforce needs. [Nothing bolted on.]"
        description="From hiring to knowledge to channels to workflows to governance — one operating system, end to end."
      />

      <RevealGroup className="mt-14 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {FEATURES.map((f) => (
          <RevealItem
            key={f.title}
            className={`group rounded-3xl border border-neutral-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-neutral-300 hover:shadow-taurus-lift ${f.span ?? ""}`}
          >
            {f.visual ? (
              <div className="mb-4 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50/60 p-2">
                <MicroVisual kind={f.visual} />
              </div>
            ) : null}
            <h3 className="text-[15px] font-semibold text-neutral-950">{f.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{f.body}</p>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mt-12 text-center">
        <SecondaryCta href="/signup">Start exploring the platform</SecondaryCta>
      </Reveal>
    </section>
  );
}

"use client";

/**
 * Landing v3 — enterprise security (Sprint 055).
 *
 * The one deliberately dark scene on the page: a full-bleed near-black panel
 * with an animated control architecture — concentric permission rings around
 * the organisation's data, four control pillars, and the governance list. The
 * copy claims only what the product does (approvals, audit, isolation,
 * encryption, limits) — no invented certifications.
 */

import { Reveal, RevealGroup, RevealItem, SectionHeading, SecondaryCta } from "@/components/landing/v3/motion";

const PILLARS = [
  {
    title: "Access",
    body: "Role-based permissions, per-employee scopes and encrypted credentials — everyone and everything gets exactly the access it needs.",
  },
  {
    title: "Governance",
    body: "Decision boundaries, usage limits, model governance and plan-level controls set the rules your workforce operates inside.",
  },
  {
    title: "Transparency",
    body: "Every conversation, workflow step and decision lands in the audit trail with who, what and when attached.",
  },
  {
    title: "Human oversight",
    body: "Approval checkpoints pause sensitive actions until a human says go. Escalation policies bring people in at the right moment.",
  },
];

const CONTROLS = [
  "Encrypted credentials at rest",
  "Organisational data isolation",
  "Role-based access control",
  "Human approval checkpoints",
  "Complete audit trails",
  "Employee-level permissions",
  "Secure Knowledge Vault",
  "Data source controls",
  "Model governance",
  "Usage limits and quotas",
  "Activity monitoring",
  "Escalation policies",
];

function SecurityDiagram() {
  return (
    <svg viewBox="0 0 520 420" className="h-auto w-full" role="img" aria-label="Concentric layers of control around organisational data: approvals, permissions and audit">
      <g transform="translate(260 210)">
        <circle r={185} className="fill-none stroke-neutral-800" strokeWidth={1} />
        <circle r={185} className="fill-none stroke-neutral-500 landing-dash-slow" strokeWidth={1} />
        <circle r={130} className="fill-none stroke-neutral-800" strokeWidth={1} strokeDasharray="2 7" />
        <circle r={130} className="fill-none stroke-neutral-600 landing-dash-slow" strokeWidth={1} />
        <circle r={78} className="fill-none stroke-neutral-700" strokeWidth={1} />
        <circle r={78} className="fill-neutral-900/40 landing-breathe" />

        {/* Layer labels */}
        <g transform="translate(0 -185)">
          <rect x={-70} y={-12} width={140} height={24} rx={12} className="fill-neutral-900 stroke-neutral-700" strokeWidth={1} />
          <text y={4} textAnchor="middle" className="fill-neutral-300 text-[10px] font-medium tracking-[0.12em]">
            ACTIVITY MONITORING
          </text>
        </g>
        <g transform="translate(0 -130)">
          <rect x={-64} y={-12} width={128} height={24} rx={12} className="fill-neutral-900 stroke-neutral-700" strokeWidth={1} />
          <text y={4} textAnchor="middle" className="fill-neutral-300 text-[10px] font-medium tracking-[0.12em]">
            HUMAN APPROVALS
          </text>
        </g>
        <g transform="translate(0 -78)">
          <rect x={-58} y={-12} width={116} height={24} rx={12} className="fill-neutral-900 stroke-neutral-700" strokeWidth={1} />
          <text y={4} textAnchor="middle" className="fill-neutral-300 text-[10px] font-medium tracking-[0.12em]">
            PERMISSIONS
          </text>
        </g>

        {/* Vault core */}
        <g style={{ filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.6))" }}>
          <rect x={-56} y={-30} width={112} height={60} rx={16} className="fill-white" />
          <text y={-2} textAnchor="middle" className="fill-neutral-950 text-[11px] font-bold tracking-[0.08em]">
            YOUR DATA
          </text>
          <text y={14} textAnchor="middle" className="fill-neutral-500 text-[9px] tracking-[0.16em]">
            KNOWLEDGE VAULT
          </text>
        </g>

        {/* Orbiting audit dot */}
        <g className="landing-orbit" style={{ animationDuration: "26s" }}>
          <circle cx={130} cy={0} r={3.5} className="fill-white" />
        </g>
        <g className="landing-orbit-reverse" style={{ animationDuration: "40s" }}>
          <circle cx={-185} cy={0} r={3} className="fill-neutral-500" />
        </g>
      </g>
    </svg>
  );
}

export function Security() {
  return (
    <section id="security" className="relative scroll-mt-24 px-3 py-10 sm:px-5">
      <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2.5rem] bg-neutral-950 px-5 py-24 text-white sm:px-10 sm:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_400px_at_50%_-10%,rgba(255,255,255,0.07),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"
        />

        <div className="relative mx-auto max-w-6xl">
          <SectionHeading
            dark
            eyebrow="Enterprise security & control"
            title="Autonomous where it helps. [Controlled] where it matters."
            description="Every action an AI Employee takes can be authorised, monitored, reviewed and traced."
          />

          <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <SecurityDiagram />
            </Reveal>

            <div>
              <RevealGroup className="grid gap-4 sm:grid-cols-2">
                {PILLARS.map((p) => (
                  <RevealItem key={p.title} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
                    <h3 className="text-base font-semibold text-white">{p.title}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">{p.body}</p>
                  </RevealItem>
                ))}
              </RevealGroup>
              <RevealGroup className="mt-6 flex flex-wrap gap-2">
                {CONTROLS.map((c) => (
                  <RevealItem key={c}>
                    <span className="inline-block rounded-full border border-neutral-800 px-3.5 py-1.5 text-[11px] font-medium text-neutral-400">
                      {c}
                    </span>
                  </RevealItem>
                ))}
              </RevealGroup>
              <Reveal className="mt-9">
                <SecondaryCta dark href="#contact">
                  Talk to us about enterprise security
                </SecondaryCta>
              </Reveal>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

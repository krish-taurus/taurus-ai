"use client";

/**
 * Landing v3 — AI Employees that work together (Sprint 055).
 *
 * One real business workflow, staged as a living pipeline: a lead enters, and
 * task tokens physically travel the wire between specialised AI Employees —
 * qualify → research → schedule → onboard — pausing at the human approval
 * gate before the deal goes out. The tokens are CSS offset-path animations in
 * SVG user space, so they scale with the scene and stop under reduced motion.
 */

import { Reveal, SectionHeading, PrimaryCta } from "@/components/landing/v3/motion";

const PATH = "M 60 200 C 200 80, 320 80, 450 160 S 700 280, 840 180 S 1060 90, 1140 170";

const STATIONS = [
  { x: 60, y: 200, label: "Website lead", sub: "arrives", human: false },
  { x: 320, y: 103, label: "Sales Employee", sub: "qualifies the lead", human: false },
  { x: 560, y: 208, label: "Research Employee", sub: "prepares company intel", human: false },
  { x: 840, y: 180, label: "Scheduling Employee", sub: "books the meeting", human: false },
  { x: 1000, y: 122, label: "Human manager", sub: "approves the proposal", human: true },
  { x: 1140, y: 170, label: "Operations Employee", sub: "creates onboarding tasks", human: false },
];

export function Collaboration() {
  return (
    <section className="relative overflow-hidden bg-neutral-50/60 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Coordinated work"
          title="AI Employees that [work together.]"
          description="Specialised employees share context, hand work to each other and coordinate outcomes — while humans keep the final say on what matters."
        />

        <Reveal className="mt-14">
          <div className="relative overflow-x-auto rounded-3xl border border-neutral-200 bg-white p-4 shadow-taurus sm:p-6">
            <svg
              viewBox="0 0 1200 320"
              className="h-auto w-full min-w-[760px]"
              role="img"
              aria-label="A workflow where a website lead is qualified by a Sales AI Employee, researched, scheduled, approved by a human manager, then onboarded by an Operations AI Employee"
            >
              {/* The wire */}
              <path d={PATH} className="stroke-neutral-200" strokeWidth={2} fill="none" />
              <path d={PATH} className="stroke-neutral-900 landing-dash-slow" strokeWidth={2} fill="none" />

              {/* Travelling task tokens (offset-path in SVG user space) */}
              {[0, -3.5, -7].map((delay, i) => (
                <g key={i}>
                  <circle
                    r={i === 0 ? 7 : 5}
                    className="landing-travel fill-neutral-950"
                    style={{
                      offsetPath: `path("${PATH}")`,
                      offsetRotate: "0deg",
                      animationDuration: "10.5s",
                      animationDelay: `${delay}s`,
                    }}
                  />
                  <circle
                    r={i === 0 ? 12 : 9}
                    className="landing-travel fill-neutral-950/10"
                    style={{
                      offsetPath: `path("${PATH}")`,
                      offsetRotate: "0deg",
                      animationDuration: "10.5s",
                      animationDelay: `${delay}s`,
                    }}
                  />
                </g>
              ))}

              {/* Stations */}
              {STATIONS.map((s) => (
                <g key={s.label} transform={`translate(${s.x} ${s.y})`}>
                  {s.human ? (
                    <>
                      <rect x={-14} y={-14} width={28} height={28} rx={9} className="fill-white stroke-neutral-900" strokeWidth={2} />
                      <circle cx={0} cy={-3.5} r={3.5} className="fill-neutral-900" />
                      <path d="M-6 8 C-6 2, 6 2, 6 8" className="fill-neutral-900" />
                    </>
                  ) : (
                    <>
                      <circle r={15} className="fill-neutral-950" />
                      <circle r={15} className="fill-none stroke-neutral-300 landing-pulse" strokeWidth={1.5} />
                      <circle r={4} className="fill-white" />
                    </>
                  )}
                  <text y={s.y > 160 ? 44 : -32} textAnchor="middle" className="fill-neutral-900 text-[13px] font-semibold">
                    {s.label}
                  </text>
                  <text y={s.y > 160 ? 62 : -14} textAnchor="middle" className="fill-neutral-400 text-[11px]">
                    {s.sub}
                  </text>
                </g>
              ))}

              {/* Approval gate note */}
              <g transform="translate(1000 208)">
                <rect x={-64} y={-13} width={128} height={26} rx={13} className="fill-neutral-100" />
                <text y={4} textAnchor="middle" className="fill-neutral-500 text-[10px] font-medium">
                  Waits for approval ✓
                </text>
              </g>
            </svg>
          </div>
        </Reveal>

        <Reveal className="mx-auto mt-8 max-w-2xl text-center" delay={0.1}>
          <p className="text-[15px] leading-relaxed text-neutral-500">
            Workflows chain employees together with branching, hand-offs, approval checkpoints, scheduled
            triggers and a full run history — draw it on a canvas or build it as a list, then watch every
            step in the trace.
          </p>
        </Reveal>

        <Reveal className="mt-10 text-center" delay={0.15}>
          <PrimaryCta href="/signup">Build your digital workforce</PrimaryCta>
        </Reveal>
      </div>
    </section>
  );
}

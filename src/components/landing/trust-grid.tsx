"use client";

/**
 * Enterprise trust section (Premium Landing v2).
 *
 * Careful language: "designed for enterprise governance" — no certification
 * claims. Eight quiet, confident cards.
 */

import { RevealGroup, RevealItem, SectionHeading } from "@/components/landing/reveal";

const TRUST: { title: string; body: string }[] = [
  {
    title: "Organization isolation",
    body: "Every Employee, conversation, and document scoped to your company.",
  },
  {
    title: "Role-based access",
    body: "Owners, admins, builders, and viewers — least privilege by default.",
  },
  { title: "Audit history", body: "Metadata-only records of every meaningful action." },
  { title: "Human handoff", body: "People stay in the loop wherever judgment matters." },
  { title: "Model controls", body: "Decide which AI models your Employees may use, and where." },
  { title: "Knowledge control", body: "Approve exactly which sources each Employee can draw on." },
  { title: "Usage visibility", body: "See activity and estimated cost across the workforce." },
  { title: "Secure channel deployment", body: "Pause or revoke any channel at any time." },
];

export function TrustGrid() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Enterprise trust"
          title="Governance from day one."
          description="Taurus is designed for enterprise governance — control, visibility, and accountability are part of the operating system, not an add-on."
        />

        <RevealGroup className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((item) => (
            <RevealItem key={item.title}>
              <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-300 hover:border-white/20">
                <div
                  aria-hidden
                  className="mb-4 h-px w-8 bg-white/30 transition-all duration-500 group-hover:w-14 group-hover:bg-white/60"
                />
                <h3 className="text-sm font-semibold text-taurus-text">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-taurus-faint">{item.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

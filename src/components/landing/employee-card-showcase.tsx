"use client";

/**
 * AI Employee card showcase (Premium Landing v2).
 *
 * Eight role cards staggering in with hover lift + border glow — the "build a
 * workforce by role" moment. Each card reads like a real Taurus employee record.
 */

import { motion } from "framer-motion";
import { RevealGroup, RevealItem, SectionHeading } from "@/components/landing/reveal";

interface ShowcaseEmployee {
  initial: string;
  name: string;
  role: string;
  department: string;
  status: "Active" | "Ready";
  dna: string;
  knowledge: string;
  channels: string;
}

const EMPLOYEES: ShowcaseEmployee[] = [
  {
    initial: "I",
    name: "Iris",
    role: "AI Receptionist",
    department: "Front Desk",
    status: "Active",
    dna: "DNA published",
    knowledge: "6 sources",
    channels: "Website · Voice-ready",
  },
  {
    initial: "M",
    name: "Maya",
    role: "AI Sales Assistant",
    department: "Revenue",
    status: "Active",
    dna: "DNA published",
    knowledge: "9 sources",
    channels: "Website · WhatsApp",
  },
  {
    initial: "A",
    name: "Atlas",
    role: "AI Customer Support Employee",
    department: "Support",
    status: "Active",
    dna: "DNA published",
    knowledge: "14 sources",
    channels: "Email · Chat",
  },
  {
    initial: "N",
    name: "Nova",
    role: "AI HR Assistant",
    department: "People",
    status: "Ready",
    dna: "DNA published",
    knowledge: "8 sources",
    channels: "Internal",
  },
  {
    initial: "O",
    name: "Orion",
    role: "AI Operations Assistant",
    department: "Operations",
    status: "Active",
    dna: "DNA published",
    knowledge: "11 sources",
    channels: "Email · Inbox",
  },
  {
    initial: "V",
    name: "Vera",
    role: "AI Finance Assistant",
    department: "Finance",
    status: "Ready",
    dna: "DNA published",
    knowledge: "7 sources",
    channels: "Internal",
  },
  {
    initial: "L",
    name: "Lex",
    role: "AI Legal Intake Assistant",
    department: "Legal",
    status: "Ready",
    dna: "DNA published",
    knowledge: "5 sources",
    channels: "Website · Email",
  },
  {
    initial: "S",
    name: "Sage",
    role: "AI Internal Knowledge Assistant",
    department: "Company-wide",
    status: "Active",
    dna: "DNA published",
    knowledge: "22 sources",
    channels: "Internal · Chat",
  },
];

export function EmployeeCardShowcase() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="The workforce"
          title="Build an AI workforce by role."
          description="From first hire to full AI workforce — every Employee with its own DNA, knowledge, and channels."
        />

        <RevealGroup className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EMPLOYEES.map((employee) => (
            <RevealItem key={employee.name}>
              <motion.article
                whileHover={{ y: -6 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition-[border-color,box-shadow] duration-300 hover:border-white/25 hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9),0_0_36px_rgba(255,255,255,0.05)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-sm font-semibold text-taurus-text transition-colors duration-300 group-hover:border-white/30">
                    {employee.initial}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-taurus-text">
                      {employee.name}
                    </h3>
                    <p className="truncate text-[11px] leading-snug text-taurus-faint">
                      {employee.role}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 space-y-1.5 border-t border-white/[0.07] pt-4 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-taurus-faint">Department</dt>
                    <dd className="text-taurus-sub">{employee.department}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-taurus-faint">Status</dt>
                    <dd className="inline-flex items-center gap-1.5 text-taurus-text">
                      <span
                        aria-hidden
                        className={`h-1 w-1 rounded-full ${employee.status === "Active" ? "bg-white" : "bg-white/40"}`}
                      />
                      {employee.status}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-taurus-faint">Employee DNA</dt>
                    <dd className="text-taurus-sub">{employee.dna}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-taurus-faint">Knowledge</dt>
                    <dd className="text-taurus-sub">{employee.knowledge}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-taurus-faint">Channels</dt>
                    <dd className="text-right text-taurus-sub">{employee.channels}</dd>
                  </div>
                </dl>
              </motion.article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

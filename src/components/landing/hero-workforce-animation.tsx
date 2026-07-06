"use client";

/**
 * Hero workforce animation (Premium Landing v2).
 *
 * The living system diagram: a company at the center, AI Employees orbiting it,
 * Employee DNA / Knowledge Vault / Model Hub feeding in from the left, and
 * deployment channels lighting up on the right. Built from positioned glass
 * cards over an SVG line layer — flowing dashes carry knowledge and messages
 * through the system. Falls back to a static diagram under reduced motion.
 */

import { motion, useReducedMotion } from "framer-motion";

interface Node {
  id: string;
  x: number; // percentage
  y: number; // percentage
  title: string;
  subtitle?: string;
  kind: "core" | "employee" | "input" | "channel";
  floatClass?: string;
}

const NODES: Node[] = [
  {
    id: "core",
    x: 50,
    y: 50,
    title: "Your Company",
    subtitle: "Taurus Workforce OS",
    kind: "core",
  },
  // AI Employees around the company.
  {
    id: "maya",
    x: 50,
    y: 13,
    title: "Maya",
    subtitle: "AI Sales Assistant",
    kind: "employee",
    floatClass: "landing-float",
  },
  {
    id: "atlas",
    x: 74,
    y: 30,
    title: "Atlas",
    subtitle: "AI Support",
    kind: "employee",
    floatClass: "landing-float-delayed",
  },
  {
    id: "iris",
    x: 26,
    y: 30,
    title: "Iris",
    subtitle: "AI Receptionist",
    kind: "employee",
    floatClass: "landing-float",
  },
  // Governance inputs.
  {
    id: "dna",
    x: 9,
    y: 46,
    title: "Employee DNA",
    kind: "input",
    floatClass: "landing-float-delayed",
  },
  {
    id: "vault",
    x: 12,
    y: 68,
    title: "Knowledge Vault",
    kind: "input",
    floatClass: "landing-float",
  },
  {
    id: "hub",
    x: 22,
    y: 88,
    title: "Model Hub",
    kind: "input",
    floatClass: "landing-float-delayed",
  },
  // Channels.
  { id: "website", x: 91, y: 46, title: "Website", kind: "channel", floatClass: "landing-float" },
  {
    id: "whatsapp",
    x: 88,
    y: 68,
    title: "WhatsApp",
    kind: "channel",
    floatClass: "landing-float-delayed",
  },
  { id: "email", x: 78, y: 88, title: "Email", kind: "channel", floatClass: "landing-float" },
  {
    id: "voice",
    x: 60,
    y: 94,
    title: "Voice-ready",
    kind: "channel",
    floatClass: "landing-float-delayed",
  },
  { id: "inbox", x: 40, y: 94, title: "Inbox", kind: "channel", floatClass: "landing-float" },
];

const LINKS: [string, string][] = [
  ["dna", "core"],
  ["vault", "core"],
  ["hub", "core"],
  ["core", "maya"],
  ["core", "atlas"],
  ["core", "iris"],
  ["core", "website"],
  ["core", "whatsapp"],
  ["core", "email"],
  ["core", "voice"],
  ["core", "inbox"],
];

function nodeById(id: string): Node {
  return NODES.find((n) => n.id === id)!;
}

function cardClasses(kind: Node["kind"]): string {
  switch (kind) {
    case "core":
      return "border-white/25 bg-white/[0.08] px-5 py-3.5 shadow-[0_0_60px_rgba(255,255,255,0.08)]";
    case "employee":
      return "border-white/15 bg-white/[0.05] px-4 py-2.5";
    case "input":
      return "border-white/10 bg-white/[0.03] px-3.5 py-2";
    case "channel":
      return "border-white/10 bg-white/[0.03] px-3.5 py-2";
  }
}

export function HeroWorkforceAnimation() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="img"
      aria-label="Diagram of the Taurus operating system: Employee DNA, Knowledge Vault, and Model Hub power AI Employees for a company, deployed across website, WhatsApp, email, voice-ready, and inbox channels."
      className="relative mx-auto h-[400px] w-full max-w-4xl select-none sm:h-[480px]"
    >
      {/* Slow conic sweep for depth. */}
      {!reduceMotion ? (
        <div
          aria-hidden
          className="landing-sweep absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 [background:conic-gradient(from_0deg,transparent_0%,rgba(255,255,255,0.05)_12%,transparent_28%)]"
        />
      ) : null}

      {/* Connection lines. */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {LINKS.map(([fromId, toId]) => {
          const from = nodeById(fromId);
          const to = nodeById(toId);
          const midX = (from.x + to.x) / 2;
          const d = `M ${from.x} ${from.y} Q ${midX} ${(from.y + to.y) / 2 - 4} ${to.x} ${to.y}`;
          return (
            <g key={`${fromId}-${toId}`}>
              <path
                d={d}
                fill="none"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {!reduceMotion ? (
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  className={fromId === "core" ? "landing-dash" : "landing-dash-slow"}
                />
              ) : null}
            </g>
          );
        })}
        {/* Node glow pulses. */}
        {NODES.map((node) => (
          <circle
            key={node.id}
            cx={node.x}
            cy={node.y}
            r={node.kind === "core" ? 1.6 : 0.9}
            fill="rgba(255,255,255,0.5)"
            className={reduceMotion ? undefined : "landing-pulse"}
          />
        ))}
      </svg>

      {/* Node cards. */}
      {NODES.map((node, index) => (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.35 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <div
            className={`rounded-xl border backdrop-blur-md ${cardClasses(node.kind)} ${
              !reduceMotion && node.floatClass ? node.floatClass : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  node.kind === "employee" || node.kind === "core" ? "bg-white" : "bg-white/40"
                }`}
              />
              <div className="whitespace-nowrap">
                <p
                  className={`font-semibold leading-tight text-taurus-text ${
                    node.kind === "core" ? "text-sm" : "text-[11px] sm:text-xs"
                  }`}
                >
                  {node.title}
                </p>
                {node.subtitle ? (
                  <p className="text-[9px] leading-tight text-taurus-faint sm:text-[10px]">
                    {node.subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

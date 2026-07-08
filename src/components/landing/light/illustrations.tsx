"use client";

/**
 * Light landing illustrations (Sprint 020).
 *
 * Crisp, monochrome inline SVG artwork — the "imagery" of the light landing page.
 * Everything is stroke-based near-black on white so it stays on-brand (premium
 * monochrome) and razor-sharp at any size with zero external image requests.
 * Motion is gentle and CSS/framer-driven, so the global reduced-motion rule and
 * the shell's MotionConfig disable it automatically.
 */

import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/* -------------------------------------------------------------------------- */
/* Hero — a hired AI Employee working across channels.                        */
/* -------------------------------------------------------------------------- */

export function EmployeeHeroIllustration() {
  const channels = ["Website", "WhatsApp", "SMS", "Phone"];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]">
        {/* Employee identity */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-lg font-semibold text-white">
            M
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900">Maya</p>
            <p className="text-sm text-neutral-500">AI Sales Assistant</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
            <motion.span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-neutral-900"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            Working
          </span>
        </div>

        {/* DNA facets */}
        <div className="mt-6 space-y-2.5">
          {[
            { k: "Mission", w: "w-4/5" },
            { k: "Communication style", w: "w-2/3" },
            { k: "Boundaries", w: "w-3/4" },
          ].map((row) => (
            <div key={row.k} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {row.k}
              </p>
              <div className={`mt-1.5 h-1.5 rounded-full bg-neutral-300 ${row.w}`} />
            </div>
          ))}
        </div>

        {/* Channels lighting up */}
        <div className="mt-6 flex flex-wrap gap-2">
          {channels.map((channel, index) => (
            <motion.span
              key={channel}
              initial={{ opacity: 0.35, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 + index * 0.15, ease: EASE }}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-medium text-white"
            >
              <span aria-hidden className="h-1 w-1 rounded-full bg-white" />
              {channel}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Floating stat chips for depth. */}
      <motion.div
        aria-hidden
        className="absolute -left-6 top-10 hidden rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-lg sm:block"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <p className="text-2xl font-semibold text-neutral-900">24/7</p>
        <p className="text-[11px] text-neutral-500">Always on</p>
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute -right-4 bottom-8 hidden rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-lg sm:block"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <p className="text-2xl font-semibold text-neutral-900">&lt;1s</p>
        <p className="text-[11px] text-neutral-500">First reply</p>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Line icons — used across sections. Inherit currentColor.                    */
/* -------------------------------------------------------------------------- */

type IconProps = { className?: string };

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconGlobe({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </Svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 5h16v11H8l-4 4V5Z" />
      <path d="M8 10h8M8 13h5" />
    </Svg>
  );
}

export function IconPhone({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

export function IconMessage({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1-4.6A8.5 8.5 0 1 1 21 11.5Z" />
    </Svg>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function IconChart({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 4v16h16" />
      <path d="M8 15l3-4 3 2 4-6" />
    </Svg>
  );
}

export function IconCpu({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
    </Svg>
  );
}

export function IconCart({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 4h2l2 12h11l2-8H7" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </Svg>
  );
}

export function IconStethoscope({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <path d="M10 15a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="10" r="2" />
    </Svg>
  );
}

export function IconBuilding({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 21V5l8-3 8 3v16" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" />
    </Svg>
  );
}

export function IconBriefcase({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </Svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 12l4 4L19 7" />
    </Svg>
  );
}

export function IconSparkle({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </Svg>
  );
}

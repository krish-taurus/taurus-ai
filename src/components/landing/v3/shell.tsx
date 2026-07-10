"use client";

/**
 * Landing v3 shell (Sprint 055).
 *
 * White canvas, near-black ink. Honors the visitor's reduced-motion preference
 * globally via MotionConfig (framer) — the CSS animations are silenced by the
 * matching media rule in globals.css. Two GPU-cheap atmospheric washes keep the
 * large white sections from feeling flat.
 */

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip bg-white text-neutral-900 antialiased">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(1100px_520px_at_50%_-8%,rgba(0,0,0,0.05),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(900px_600px_at_88%_115%,rgba(0,0,0,0.035),transparent_70%)]"
        />
        <div className="relative z-10">{children}</div>
      </div>
    </MotionConfig>
  );
}

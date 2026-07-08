"use client";

/**
 * Light landing shell (Sprint 020 — Landing Page).
 *
 * The marketing home page is a white-background, dark-ink experience: the premium
 * monochrome design language inverted for a bright, editorial feel. This shell
 * forces a light surface regardless of the app's dark tokens, honors the user's
 * reduced-motion preference via MotionConfig, and paints two soft, GPU-cheap
 * atmospheric washes so large white sections never feel flat.
 */

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

export function LandingShellLight({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip bg-white text-neutral-900 antialiased">
        {/* Fixed atmospheric layers — subtle neutral washes, no color. */}
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

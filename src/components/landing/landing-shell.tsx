"use client";

/**
 * Landing shell (Premium Landing v2).
 *
 * Wraps the whole landing page in a MotionConfig that honors the user's
 * reduced-motion preference, and paints a subtle mouse-following monochrome
 * spotlight behind the content. The spotlight is pointer-events-none, uses a
 * spring so it never jitters, and is simply omitted on reduced motion.
 */

import {
  MotionConfig,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { useEffect, type ReactNode } from "react";

function MouseSpotlight() {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(-600);
  const y = useMotionValue(-600);
  const springX = useSpring(x, { stiffness: 60, damping: 20, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 60, damping: 20, mass: 0.6 });
  const background = useMotionTemplate`radial-gradient(480px circle at ${springX}px ${springY}px, rgba(255,255,255,0.045), transparent 70%)`;

  useEffect(() => {
    if (reduceMotion) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x.set(event.clientX);
      y.set(event.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduceMotion, x, y]);

  if (reduceMotion) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ background }}
    />
  );
}

export function LandingShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-clip bg-[#030303] text-taurus-text">
        {/* Fixed atmospheric layers — cheap, GPU-friendly gradients only. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(1100px_520px_at_50%_-8%,rgba(255,255,255,0.06),transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(900px_600px_at_85%_110%,rgba(255,255,255,0.03),transparent_70%)]"
        />
        <MouseSpotlight />
        <div className="relative z-10">{children}</div>
      </div>
    </MotionConfig>
  );
}

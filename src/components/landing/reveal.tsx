"use client";

/**
 * Scroll-reveal primitives (Premium Landing v2).
 *
 * Thin wrappers around framer-motion so every landing section shares the same
 * cinematic entrance language: soft fade-up with a premium ease, staggered
 * children, and viewport-once triggering. Reduced motion is handled globally by
 * the MotionConfig in LandingShell.
 */

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.9, ease: EASE } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

/** Fade-up a block when it scrolls into view (once). */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, y: 28 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Parent that staggers its <RevealItem> children into view. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={staggerParent}
    >
      {children}
    </motion.div>
  );
}

/** A staggered child inside <RevealGroup>. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/** Shared eyebrow + headline + description block for landing sections. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  const alignment = align === "center" ? "mx-auto text-center" : "text-left";
  return (
    <Reveal className={`max-w-2xl ${alignment}`}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-taurus-faint">
        {eyebrow}
      </p>
      <h2 className="text-balance text-3xl font-semibold tracking-tight text-taurus-text sm:text-4xl md:text-[2.75rem] md:leading-[1.1]">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 text-pretty text-base leading-relaxed text-taurus-sub sm:text-lg">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

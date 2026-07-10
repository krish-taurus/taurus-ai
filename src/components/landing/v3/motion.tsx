"use client";

/**
 * Landing v3 motion kit (Sprint 055) — the shared cinematic vocabulary.
 *
 * Every trick the page uses lives here so sections stay consistent: masked
 * word-by-word headline reveals, magnetic CTAs, scroll-linked counters, an
 * infinite marquee, and a cursor-responsive tilt card. Monochrome, GPU-cheap
 * (transforms + opacity only), and reduced-motion-safe: the shell's
 * MotionConfig plus the global CSS rule quiet everything down.
 */

import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Scroll progress (0→1) through a pinned track, measured from the element's
 * LIVE bounding rect on every scroll frame. useScroll's element offsets are
 * resolved once and go stale if the document's layout settles after they were
 * measured (observed during hydration) — which freezes a pinned scene. Reading
 * the rect live is immune to that and costs one rect lookup per frame.
 */
export function usePinnedProgress(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollY } = useScroll();
  return useTransform(scrollY, () => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return 0;
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, -rect.top / total));
  });
}

/* ------------------------------------------------------------------ */
/* Reveal primitives                                                    */
/* ------------------------------------------------------------------ */

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

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
        hidden: { opacity: 0, y: 26 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE, delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* WordReveal — oversized editorial headlines, word by word             */
/* ------------------------------------------------------------------ */

/**
 * Splits a headline into words and raises each out of a clipped mask with a
 * stagger — the signature "editorial launch page" reveal. Words wrapped in
 * [brackets] render in grey to build the black/grey rhythm of big headlines.
 */
export function WordReveal({
  text,
  as: Tag = "h2",
  className,
  delay = 0,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
}) {
  const words = text.split(" ");
  return (
    <Tag className={className}>
      <span className="sr-only">{text.replace(/[[\]]/g, "")}</span>
      <motion.span
        aria-hidden
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.055, delayChildren: delay } },
        }}
        className="inline"
      >
        {words.map((word, i) => {
          const grey = word.startsWith("[") || word.endsWith("]");
          const clean = word.replace(/[[\]]/g, "");
          return (
            <span key={`${clean}-${i}`} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
              <motion.span
                className={`inline-block will-change-transform ${grey ? "text-neutral-400" : ""}`}
                variants={{
                  hidden: { y: "110%" },
                  show: { y: "0%", transition: { duration: 0.85, ease: EASE } },
                }}
              >
                {clean}
                {i < words.length - 1 ? " " : ""}
              </motion.span>
            </span>
          );
        })}
      </motion.span>
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic — CTAs that lean toward the cursor                          */
/* ------------------------------------------------------------------ */

export function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.5 });

  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className ?? ""}`}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* CountUp — dashboard numbers that earn their entrance                 */
/* ------------------------------------------------------------------ */

export function CountUp({
  to,
  duration = 1.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Marquee — an endless band of capabilities                            */
/* ------------------------------------------------------------------ */

export function Marquee({
  items,
  className,
  reverse = false,
}: {
  items: string[];
  className?: string;
  reverse?: boolean;
}) {
  const row = (
    <div
      className={`flex shrink-0 items-center gap-3 pr-3 ${reverse ? "landing-marquee-reverse" : "landing-marquee"}`}
      aria-hidden
    >
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="flex items-center gap-3 whitespace-nowrap text-sm font-medium text-neutral-400"
        >
          <span className="h-1 w-1 rounded-full bg-neutral-300" />
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div className={`flex overflow-hidden ${className ?? ""}`} role="presentation">
      <span className="sr-only">{items.join(", ")}</span>
      {row}
      {row}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TiltCard — cursor-responsive depth for product mock-ups              */
/* ------------------------------------------------------------------ */

export function TiltCard({
  children,
  className,
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 20 });
  const sry = useSpring(ry, { stiffness: 150, damping: 20 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d", perspective: 1200 }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Section heading — the shared editorial block                          */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  dark = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  dark?: boolean;
}) {
  const alignment = align === "center" ? "mx-auto text-center" : "text-left";
  return (
    <div className={`max-w-3xl ${alignment}`}>
      <Reveal>
        <p
          className={`mb-5 text-[11px] font-semibold uppercase tracking-[0.32em] ${
            dark ? "text-neutral-500" : "text-neutral-400"
          }`}
        >
          {eyebrow}
        </p>
      </Reveal>
      <WordReveal
        text={title}
        className={`text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.03em] sm:text-5xl md:text-6xl ${
          dark ? "text-white" : "text-neutral-950"
        }`}
      />
      {description ? (
        <Reveal delay={0.25}>
          <p
            className={`mt-6 text-pretty text-base leading-relaxed sm:text-lg ${
              dark ? "text-neutral-400" : "text-neutral-500"
            }`}
          >
            {description}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CTA buttons — one consistent conversion language                     */
/* ------------------------------------------------------------------ */

export function PrimaryCta({
  href,
  children,
  dark = false,
}: {
  href: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <Magnetic>
      <a
        href={href}
        className={`group inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-300 ${
          dark
            ? "bg-white text-neutral-950 hover:shadow-[0_0_0_6px_rgba(255,255,255,0.12)]"
            : "bg-neutral-950 text-white hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]"
        }`}
      >
        {children}
        <span
          aria-hidden
          className="inline-block transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </a>
    </Magnetic>
  );
}

export function SecondaryCta({
  href,
  children,
  dark = false,
}: {
  href: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <Magnetic strength={0.22}>
      <a
        href={href}
        className={`inline-flex items-center gap-2 rounded-full border px-7 py-3.5 text-sm font-semibold transition-colors duration-300 ${
          dark
            ? "border-neutral-700 text-neutral-200 hover:border-neutral-500 hover:text-white"
            : "border-neutral-300 text-neutral-700 hover:border-neutral-900 hover:text-neutral-950"
        }`}
      >
        {children}
      </a>
    </Magnetic>
  );
}

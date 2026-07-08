"use client";

/**
 * Shared eyebrow + oversized headline + description for the light landing page.
 * Large, editorial type on white; reveals on scroll via <Reveal>.
 */

import { Reveal } from "@/components/landing/reveal";

export function SectionHeadingLight({
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
    <Reveal className={`max-w-3xl ${alignment}`}>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-neutral-400">
        {eyebrow}
      </p>
      <h2 className="text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl md:text-[3.5rem] md:leading-[1.05]">
        {title}
      </h2>
      {description ? (
        <p className="mt-6 text-pretty text-lg leading-relaxed text-neutral-600 sm:text-xl">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}

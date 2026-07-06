/**
 * Badge + StatusDot primitives (Sprint 005B).
 *
 * Monochrome. To communicate status without relying on color, badges vary by
 * shade and pair with a StatusDot whose fill/level differs per state — so status
 * is distinguishable in greyscale and to color-blind users.
 */

import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export type BadgeTone = "solid" | "soft" | "outline";

const TONES: Record<BadgeTone, string> = {
  solid: "bg-taurus-primary text-taurus-onPrimary",
  soft: "bg-taurus-muted text-taurus-text",
  outline: "border border-taurus-line text-taurus-sub",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "soft", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * A small status dot. `level` controls how "present" the state reads:
 *   3 = solid white (active), 2 = mid grey, 1 = faint, 0 = hollow ring (inactive).
 */
export function StatusDot({ level = 2 }: { level?: 0 | 1 | 2 | 3 }) {
  const styles = [
    "border border-taurus-strong bg-transparent", // 0 — hollow
    "bg-taurus-faint", // 1
    "bg-taurus-sub", // 2
    "bg-taurus-text", // 3
  ][level];
  return <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles)} />;
}

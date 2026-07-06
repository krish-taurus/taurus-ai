/**
 * Data-display primitives (Sprint 005B): StatCard, Progress, Skeleton.
 */

import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Card } from "@/components/ui/card";

/** Compact metric tile. */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-taurus-faint">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-taurus-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-taurus-faint">{hint}</p> : null}
    </Card>
  );
}

/** Monochrome progress bar (0–100). */
export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-taurus-muted", className)}
    >
      <div
        className="h-full rounded-full bg-taurus-text transition-[width] duration-500 ease-taurus"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Loading placeholder block (pulse respects reduced-motion via globals). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-taurus-muted", className)} />;
}

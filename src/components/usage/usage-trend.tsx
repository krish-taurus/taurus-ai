/**
 * Daily interactions trend (Sprint 016) — a simple, dependency-free bar strip.
 * One bar per day across the current billing period. Customer-facing: counts
 * only, never cost.
 */

import type { UsageTrendPoint } from "@/modules/usage/service";

export function UsageTrend({ points }: { points: UsageTrendPoint[] }) {
  const max = points.reduce((m, p) => Math.max(m, p.interactions), 0);
  const total = points.reduce((s, p) => s + p.interactions, 0);

  if (points.length === 0 || total === 0) {
    return <p className="text-sm text-taurus-faint">No interactions yet this period.</p>;
  }

  return (
    <div>
      <div className="flex h-32 items-end gap-0.5 overflow-x-auto" role="img" aria-label="Interactions per day">
        {points.map((p) => {
          const heightPct = max > 0 ? Math.max(2, Math.round((p.interactions / max) * 100)) : 0;
          return (
            <div
              key={p.date}
              className="flex min-w-[6px] flex-1 items-end"
              title={`${p.date}: ${p.interactions.toLocaleString()} interactions`}
            >
              <div
                className="w-full rounded-t bg-taurus-text"
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-taurus-faint">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

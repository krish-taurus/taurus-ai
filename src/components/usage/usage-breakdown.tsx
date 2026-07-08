/**
 * Usage breakdown list (Sprint 016) — a labeled bar per row (by AI Employee or
 * by channel). Customer-facing: interactions only, never cost or margin.
 */

import { Card } from "@/components/ui";
import type { UsageBreakdownRow } from "@/modules/usage/service";

export function UsageBreakdown({
  title,
  rows,
  total,
  emptyLabel,
}: {
  title: string;
  rows: UsageBreakdownRow[];
  total: number;
  emptyLabel: string;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-taurus-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-taurus-faint">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((row) => {
            const percent = total > 0 ? Math.round((row.interactions / total) * 100) : 0;
            return (
              <li key={row.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-taurus-text">{row.label}</span>
                  <span className="tabular-nums text-taurus-sub">
                    {row.interactions.toLocaleString()}
                    <span className="ml-1 text-xs text-taurus-faint">({percent}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-taurus-muted">
                  <div
                    className="h-full rounded-full bg-taurus-text"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

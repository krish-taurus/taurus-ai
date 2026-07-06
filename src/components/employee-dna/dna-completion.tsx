/**
 * Employee DNA completion display (Prompt 005). Presentational, server-safe.
 */

import type { DnaCompletion } from "@/modules/employee-dna/scoring";

export function DnaCompletionCard({ completion }: { completion: DnaCompletion }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Completion</h2>
        <span className="text-2xl font-semibold text-taurus-accent">{completion.overall}%</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-taurus-accent transition-all"
          style={{ width: `${completion.overall}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        {completion.categories.map((category) => (
          <li key={category.key} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{category.label}</span>
            <span className={category.complete ? "font-medium text-green-700" : "text-slate-400"}>
              {category.complete ? "Complete" : `${category.percent}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

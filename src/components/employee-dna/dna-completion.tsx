/**
 * Employee DNA completion display (Prompt 005; restyled 005B). Server-safe.
 */

import type { DnaCompletion } from "@/modules/employee-dna/scoring";
import { Card, Progress, StatusDot } from "@/components/ui";

export function DnaCompletionCard({ completion }: { completion: DnaCompletion }) {
  return (
    <Card className="p-5">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-semibold text-taurus-text">Completion</h2>
        <span className="text-3xl font-semibold tracking-tight text-taurus-text">
          {completion.overall}
          <span className="text-lg text-taurus-faint">%</span>
        </span>
      </div>

      <div className="mt-3">
        <Progress value={completion.overall} />
      </div>

      <ul className="mt-4 space-y-2">
        {completion.categories.map((category) => (
          <li key={category.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-taurus-sub">
              <StatusDot level={category.complete ? 3 : category.percent > 0 ? 1 : 0} />
              {category.label}
            </span>
            <span
              className={category.complete ? "font-medium text-taurus-text" : "text-taurus-faint"}
            >
              {category.complete ? "Complete" : `${category.percent}%`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

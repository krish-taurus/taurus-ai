/**
 * Usage-vs-quota meter (Sprint 015). Server component — renders a labeled
 * progress bar for one entitlement. At or over the limit it reads "Limit
 * reached" so the state is clear without relying on color.
 */

import type { EntitlementUsage } from "@/modules/billing/service";
import { Card, Progress } from "@/components/ui";

export function UsageMeter({ usage }: { usage: EntitlementUsage }) {
  const atLimit = !usage.unlimited && usage.used >= usage.limit;
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-taurus-text">{usage.label}</p>
        <p className="text-sm tabular-nums text-taurus-sub">
          {usage.unlimited
            ? `${usage.used.toLocaleString()} / Unlimited`
            : `${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()}`}
        </p>
      </div>
      <div className="mt-3">
        <Progress value={usage.percent} />
      </div>
      <p className="mt-2 text-xs text-taurus-faint">
        {usage.unlimited
          ? "Unlimited on your plan"
          : atLimit
            ? "Limit reached — upgrade for more headroom."
            : `${usage.percent}% used`}
      </p>
    </Card>
  );
}

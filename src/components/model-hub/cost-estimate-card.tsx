/**
 * Cost estimate card (Prompt 006B).
 *
 * Shows approximate cost for a few example workloads so admins can compare
 * models in plain terms. Always paired with the pricing disclaimer.
 */

import { Card } from "@/components/ui";
import type { AiModel } from "@/modules/model-gateway/types";
import { COST_EXAMPLE_SCENARIOS, estimateCost, formatUsd } from "@/modules/model-gateway/pricing";
import { PricingDisclaimer } from "@/components/model-hub/pricing-disclaimer";

export function CostEstimateCard({ model }: { model: AiModel }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-taurus-faint">
        Estimated cost — {model.displayName}
      </p>
      <ul className="mt-4 space-y-2">
        {COST_EXAMPLE_SCENARIOS.map((scenario) => {
          const cost = estimateCost(model, scenario.usage);
          return (
            <li key={scenario.label} className="flex items-center justify-between text-sm">
              <span className="text-taurus-sub">{scenario.label}</span>
              <span className="font-medium text-taurus-text">
                {cost.status === "known" ? formatUsd(cost.totalUsd) : "Price not listed"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-taurus-faint">
        Examples assume roughly 1K–50K words in and 500–8K words out.
      </p>
      <div className="mt-4">
        <PricingDisclaimer />
      </div>
    </Card>
  );
}

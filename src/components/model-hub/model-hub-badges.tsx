/**
 * Model Hub display badges (Prompt 006B).
 *
 * Small, monochrome status/label chips. Plain language only — no "agent"/"prompt".
 */

import { Badge } from "@/components/ui";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import { TIER_LABELS } from "@/modules/model-gateway/metadata";

export function TierBadge({ tier }: { tier: AiModel["modelTier"] }) {
  return <Badge tone="outline">{TIER_LABELS[tier]}</Badge>;
}

export function ProviderBadge({ provider }: { provider: ModelProvider }) {
  return <Badge tone="soft">{provider.displayName}</Badge>;
}

/** A compact list of capability chips (only the ones the model supports). */
export function CapabilityChips({ model }: { model: AiModel }) {
  const caps: string[] = [];
  if (model.supportsVision) caps.push("Vision");
  if (model.supportsTools) caps.push("Tools");
  if (model.supportsReasoning) caps.push("Reasoning");
  if (model.supportsAudio) caps.push("Audio");
  if (model.supportsCaching) caps.push("Caching");
  if (caps.length === 0) caps.push("Text");
  return (
    <div className="flex flex-wrap gap-1.5">
      {caps.map((c) => (
        <Badge key={c} tone="outline">
          {c}
        </Badge>
      ))}
    </div>
  );
}

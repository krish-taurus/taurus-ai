/**
 * Model catalog table (Prompt 006B).
 *
 * Advanced admin view: provider, model, tier, features, context, price, best for.
 * Scrolls horizontally inside its own container so the page never overflows.
 */

import { Card } from "@/components/ui";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import { formatUsd } from "@/modules/model-gateway/pricing";
import { TIER_LABELS } from "@/modules/model-gateway/metadata";

function featureList(model: AiModel): string {
  const feats: string[] = [];
  if (model.supportsVision) feats.push("Vision");
  if (model.supportsTools) feats.push("Tools");
  if (model.supportsReasoning) feats.push("Reasoning");
  if (model.supportsAudio) feats.push("Audio");
  if (model.supportsCaching) feats.push("Caching");
  return feats.length > 0 ? feats.join(" · ") : "Text";
}

function contextLabel(tokens: number | null): string {
  if (!tokens) return "—";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 ? 1 : 0)}M`;
  return `${Math.round(tokens / 1000)}K`;
}

export function ModelCatalogTable({
  models,
  providers,
}: {
  models: AiModel[];
  providers: ModelProvider[];
}) {
  const providerName = new Map(providers.map((p) => [p.slug, p.displayName]));

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-taurus-line text-left text-xs uppercase tracking-[0.1em] text-taurus-faint">
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Features</th>
              <th className="px-4 py-3 font-medium">Context</th>
              <th className="px-4 py-3 font-medium">In / Out (per 1M)</th>
              <th className="px-4 py-3 font-medium">Best for</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr
                key={model.modelId}
                className="border-b border-taurus-line/60 last:border-0 align-top"
              >
                <td className="px-4 py-3 text-taurus-sub">
                  {providerName.get(model.providerSlug) ?? model.providerSlug}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-taurus-text">{model.displayName}</div>
                  <div className="mt-0.5 font-mono text-xs text-taurus-faint">{model.modelId}</div>
                </td>
                <td className="px-4 py-3 text-taurus-sub">{TIER_LABELS[model.modelTier]}</td>
                <td className="px-4 py-3 text-taurus-sub">{featureList(model)}</td>
                <td className="px-4 py-3 text-taurus-sub">
                  {contextLabel(model.contextWindowTokens)}
                </td>
                <td className="px-4 py-3 text-taurus-sub">
                  {formatUsd(model.inputUsdPerMillionTokens)} /{" "}
                  {formatUsd(model.outputUsdPerMillionTokens)}
                </td>
                <td className="px-4 py-3 text-taurus-sub">{model.recommendedFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

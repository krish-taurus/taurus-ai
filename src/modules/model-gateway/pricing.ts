/**
 * Deterministic cost estimation (Prompt 006B).
 *
 * estimatedCost =
 *   inputTokens        / 1_000_000 * inputPrice
 * + cachedInputTokens  / 1_000_000 * cachedInputPrice
 * + outputTokens       / 1_000_000 * outputPrice
 *
 * If a model has no price data, the estimate is returned as an "unknown" state
 * rather than a misleading 0. All figures are approximate — never guarantees.
 */

import type { AiModel, CostEstimate, TokenUsage } from "@/modules/model-gateway/types";

const PER_MILLION = 1_000_000;

/** Round to 6 decimal places to avoid floating-point noise in stored values. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Estimate the cost of a call. `cachedInputTokens` are billed at the cached rate
 * when the model has one; otherwise they fall back to the standard input rate.
 */
export function estimateCost(model: AiModel, usage: TokenUsage): CostEstimate {
  const hasAnyPrice =
    model.inputUsdPerMillionTokens != null || model.outputUsdPerMillionTokens != null;

  if (!hasAnyPrice) {
    return {
      status: "unknown",
      totalUsd: null,
      inputUsd: null,
      cachedInputUsd: null,
      outputUsd: null,
      currency: "USD",
    };
  }

  const inputRate = model.inputUsdPerMillionTokens ?? 0;
  const cachedRate = model.cachedInputUsdPerMillionTokens ?? inputRate;
  const outputRate = model.outputUsdPerMillionTokens ?? 0;

  const inputUsd = round((usage.inputTokens / PER_MILLION) * inputRate);
  const cachedInputUsd = round((usage.cachedInputTokens / PER_MILLION) * cachedRate);
  const outputUsd = round((usage.outputTokens / PER_MILLION) * outputRate);

  return {
    status: "known",
    totalUsd: round(inputUsd + cachedInputUsd + outputUsd),
    inputUsd,
    cachedInputUsd,
    outputUsd,
    currency: "USD",
  };
}

/** Typical example workloads shown in the UI so admins can compare models. */
export const COST_EXAMPLE_SCENARIOS: { label: string; usage: TokenUsage }[] = [
  {
    label: "Short task",
    usage: { inputTokens: 1_000, cachedInputTokens: 0, outputTokens: 500 },
  },
  {
    label: "Typical task",
    usage: { inputTokens: 8_000, cachedInputTokens: 0, outputTokens: 2_000 },
  },
  {
    label: "Long task",
    usage: { inputTokens: 50_000, cachedInputTokens: 0, outputTokens: 8_000 },
  },
];

/** Format a USD amount for display, or a dash when the price is unknown. */
export function formatUsd(value: number | null): string {
  if (value == null) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

/** The disclaimer shown anywhere pricing appears. */
export const PRICING_DISCLAIMER =
  "Pricing is an estimate and may vary by provider, region, discounts, caching, and enterprise agreement.";

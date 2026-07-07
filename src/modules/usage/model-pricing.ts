/**
 * Model pricing + cost tiers (Sprint 016) — code-authoritative, pure.
 *
 * PRICES ARE OPERATOR-MAINTAINED — VERIFY AGAINST EACH PROVIDER'S PRICING PAGE.
 * The per-token prices themselves live in ONE place, the Model Hub catalog
 * (`src/modules/model-gateway/catalog.ts`: `inputUsdPerMillionTokens` etc.). This
 * module does NOT duplicate those numbers — it reads them from the catalog and
 * layers the Sprint-016 pricing policy on top:
 *   - a `costTier` (budget | mid | frontier) per model, and
 *   - a managed per-interaction SELL price (what a managed customer pays Taurus).
 *
 * Cost tier drives two margin guardrails:
 *   - new AI Employees default to a budget-tier model, and
 *   - frontier models are BYOK-only (blocked while an org is in managed mode),
 * so Taurus can never run a high-cost frontier interaction inside a flat plan.
 *
 * Pure module: no Next.js, no DataStore, no secrets. Safe to import anywhere.
 */

import type { AiModel } from "@/modules/model-gateway/types";
import { getModel } from "@/modules/model-gateway/catalog";
import { estimateCost } from "@/modules/model-gateway/pricing";

export type CostTier = "budget" | "mid" | "frontier";

/** Display labels for the cost tiers (operator + Model Hub UI). */
export const COST_TIER_LABELS: Record<CostTier, string> = {
  budget: "Budget",
  mid: "Standard",
  frontier: "Premium",
};

/**
 * Classify a model's cost tier from its input price ($ / 1M input tokens).
 * Deny-by-default: a model with no known price is treated as **frontier** (the
 * most restrictive tier) so it can never slip into a flat managed plan.
 *
 * Thresholds are an operator policy, kept here as the single place they live:
 *   budget  ≤ $0.50/M   ·   mid  ≤ $3.00/M   ·   frontier  > $3.00/M
 */
export function costTierForModel(model: AiModel | null): CostTier {
  const inputPrice = model?.inputUsdPerMillionTokens;
  if (inputPrice == null) return "frontier";
  if (inputPrice <= 0.5) return "budget";
  if (inputPrice <= 3) return "mid";
  return "frontier";
}

/** Cost tier for a model id (deny-by-default frontier for an unknown id). */
export function costTierForModelId(modelId: string | null | undefined): CostTier {
  return costTierForModel(modelId ? getModel(modelId) : null);
}

/** Whether a model may run under MANAGED access mode (budget + mid only). */
export function isManagedAllowedModelId(modelId: string | null | undefined): boolean {
  return costTierForModelId(modelId) !== "frontier";
}

/**
 * The default AI Employee model — a budget-tier model (margin guardrail). New
 * Employees start here unless an owner/admin deliberately picks another.
 */
export const DEFAULT_EMPLOYEE_MODEL_ID = "gpt-5.4-mini";

// --- Managed sell price (defined + displayed this sprint; charged in 017) -----

/**
 * What a MANAGED customer is charged per billable interaction beyond quota.
 * Operator-configurable via env; falls back to the default. Sprint 016 only
 * *defines and displays* this — metered overage charging is Sprint 017.
 */
const DEFAULT_MANAGED_INTERACTION_PRICE_USD = 0.03;

function envPrice(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Managed per-interaction sell price. A budget interaction is cheaper to serve
 * than a mid one, so a coarse budget/mid split is offered; frontier is BYOK-only
 * (never charged as managed). Operator-configurable via env.
 */
export function managedInteractionPriceUsd(tier: CostTier = "mid"): number {
  const base = envPrice("MANAGED_INTERACTION_PRICE_USD", DEFAULT_MANAGED_INTERACTION_PRICE_USD);
  if (tier === "budget") {
    return envPrice("MANAGED_INTERACTION_PRICE_BUDGET_USD", Math.round(base * 0.5 * 1e4) / 1e4);
  }
  return base;
}

// --- Write-time cost snapshot -------------------------------------------------

export interface InteractionCostInput {
  modelId: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  /** True when the interaction ran on the customer's own key. */
  byok: boolean;
}

export interface InteractionCostSnapshot {
  /** Serving cost to Taurus. 0 for BYOK (customer bears the token cost). */
  costUsd: number;
  /** $ / 1M input tokens used for this computation (price snapshot). */
  unitInputPrice: number | null;
  /** $ / 1M output tokens used for this computation (price snapshot). */
  unitOutputPrice: number | null;
  byok: boolean;
  costTier: CostTier;
}

/**
 * Compute the serving cost of a single interaction at WRITE TIME and capture the
 * price snapshot, so historical cost stays accurate after catalog prices change.
 *
 *   - BYOK → cost is 0 to Taurus (the customer pays their provider directly).
 *   - Managed → token cost from the catalog, cached input billed at the cached
 *     rate when available; if cache data is absent we bill input at full rate
 *     (never under-report). The cache handling is shared with the Model Hub
 *     estimator so the two never diverge.
 */
export function computeInteractionCost(input: InteractionCostInput): InteractionCostSnapshot {
  const model = getModel(input.modelId);
  const costTier = costTierForModel(model);
  const unitInputPrice = model?.inputUsdPerMillionTokens ?? null;
  const unitOutputPrice = model?.outputUsdPerMillionTokens ?? null;

  if (input.byok) {
    return { costUsd: 0, unitInputPrice, unitOutputPrice, byok: true, costTier };
  }

  if (!model) {
    // Unknown model, managed mode: we cannot price it, so record 0 cost but keep
    // the snapshot nulls explicit (never a misleading fabricated number).
    return { costUsd: 0, unitInputPrice: null, unitOutputPrice: null, byok: false, costTier };
  }

  const estimate = estimateCost(model, {
    inputTokens: input.inputTokens,
    cachedInputTokens: input.cachedInputTokens,
    outputTokens: input.outputTokens,
  });
  return {
    costUsd: estimate.totalUsd ?? 0,
    unitInputPrice,
    unitOutputPrice,
    byok: false,
    costTier,
  };
}

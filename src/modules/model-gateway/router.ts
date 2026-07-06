/**
 * Model routing (Prompt 006B).
 *
 * Pure functions that decide which model should serve a task, given the catalog,
 * the organization's model settings, and any employee override. No I/O, no
 * external calls — fully deterministic and unit-testable.
 *
 * Precedence:
 *   1. Employee exact-model override (if allowed).
 *   2. Request's desiredRoutingMode, else employee routingMode, else org routingMode.
 *   3. manual / provider_locked → org default model.
 *   4. auto/cost/quality/privacy → best available model of the preferred tier.
 *   5. Fallback model → any allowed model.
 */

import type { AiModel, ModelCapability, ModelResolution } from "@/modules/model-gateway/types";
import type {
  EmployeeModelSettings,
  OrganizationModelSettings,
  ProviderSlug,
  RoutingMode,
} from "@/lib/db/types";
import { AI_MODELS, getModel } from "@/modules/model-gateway/catalog";
import { ROUTING_MODE_LABELS, TIER_FALLBACK_ORDER } from "@/modules/model-gateway/metadata";
import type { ModelTier } from "@/lib/db/types";

export interface ResolveInput {
  orgSettings: OrganizationModelSettings;
  employeeSettings?: EmployeeModelSettings | null;
  desiredRoutingMode?: RoutingMode | null;
  requiredCapabilities?: ModelCapability[];
  /** Catalog override for tests; defaults to the code catalog. */
  catalog?: AiModel[];
}

const CAPABILITY_FLAG: Record<ModelCapability, keyof AiModel> = {
  text: "supportsText",
  vision: "supportsVision",
  audio: "supportsAudio",
  tools: "supportsTools",
  json: "supportsJson",
  streaming: "supportsStreaming",
  reasoning: "supportsReasoning",
  caching: "supportsCaching",
};

/** True if the model supports every required capability. */
export function modelSupportsCapabilities(
  model: AiModel,
  required: ModelCapability[] | undefined,
): boolean {
  if (!required || required.length === 0) return true;
  return required.every((cap) => model[CAPABILITY_FLAG[cap]] === true);
}

/**
 * True if the model's provider is permitted by the org allow/block lists.
 * Empty allowlist means "all providers allowed" (except those explicitly blocked).
 */
export function providerAllowed(
  providerSlug: ProviderSlug,
  allowed: ProviderSlug[],
  blocked: ProviderSlug[],
): boolean {
  if (blocked.includes(providerSlug)) return false;
  if (allowed.length > 0 && !allowed.includes(providerSlug)) return false;
  return true;
}

/** All catalog models that are available, allowed, and capable for the request. */
export function eligibleModels(input: ResolveInput): AiModel[] {
  const catalog = input.catalog ?? AI_MODELS;
  const { allowedProviderSlugs, blockedProviderSlugs } = input.orgSettings;
  return catalog.filter(
    (m) =>
      m.status === "available" &&
      providerAllowed(m.providerSlug, allowedProviderSlugs, blockedProviderSlugs) &&
      modelSupportsCapabilities(m, input.requiredCapabilities),
  );
}

const ROUTING_TO_TIER: Partial<Record<RoutingMode, ModelTier>> = {
  cost_optimized: "economy",
  auto_balanced: "balanced",
  quality_first: "premium",
  privacy_first: "private_open",
};

/** Pick the cheapest model of a tier (by output price), preferring known prices. */
function cheapestOfTier(models: AiModel[], tier: ModelTier): AiModel | null {
  const inTier = models.filter((m) => m.modelTier === tier);
  if (inTier.length === 0) return null;
  return [...inTier].sort((a, b) => {
    const pa = a.outputUsdPerMillionTokens ?? Number.POSITIVE_INFINITY;
    const pb = b.outputUsdPerMillionTokens ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  })[0];
}

/** Pick the highest-quality model of a tier (by output price, most expensive). */
function bestOfTier(models: AiModel[], tier: ModelTier): AiModel | null {
  const inTier = models.filter((m) => m.modelTier === tier);
  if (inTier.length === 0) return null;
  return [...inTier].sort((a, b) => {
    const pa = a.outputUsdPerMillionTokens ?? 0;
    const pb = b.outputUsdPerMillionTokens ?? 0;
    return pb - pa;
  })[0];
}

function pickByTier(models: AiModel[], preferredTier: ModelTier, quality: boolean): AiModel | null {
  for (const tier of TIER_FALLBACK_ORDER[preferredTier]) {
    const picked = quality ? bestOfTier(models, tier) : cheapestOfTier(models, tier);
    if (picked) return picked;
  }
  return models[0] ?? null;
}

function resolution(
  model: AiModel | null,
  routingMode: RoutingMode,
  reason: string,
): ModelResolution {
  return {
    model,
    providerSlug: model ? model.providerSlug : null,
    routingMode,
    reason,
  };
}

/**
 * Resolve which model should serve a task. Returns a null model (with a reason)
 * when nothing is eligible — callers surface this as a configuration issue.
 */
export function resolveModelForTask(input: ResolveInput): ModelResolution {
  const { orgSettings, employeeSettings } = input;
  const eligible = eligibleModels(input);

  const routingMode: RoutingMode =
    input.desiredRoutingMode ?? employeeSettings?.routingMode ?? orgSettings.routingMode;

  const inEligible = (modelId: string | null): AiModel | null => {
    if (!modelId) return null;
    return eligible.find((m) => m.modelId === modelId) ?? null;
  };

  // 1. Employee exact-model override wins, if that model is eligible.
  if (employeeSettings?.modelId) {
    const override = inEligible(employeeSettings.modelId);
    if (override) {
      return resolution(override, routingMode, `Employee override: ${override.displayName}`);
    }
    // Requested override is blocked/unavailable — fall through to routing.
  }

  // 2. manual / provider_locked → use the org default model if eligible.
  if (routingMode === "manual" || routingMode === "provider_locked") {
    const def = inEligible(orgSettings.defaultModelId);
    if (def) {
      return resolution(def, routingMode, `Organization default: ${def.displayName}`);
    }
  }

  // 3. Tier-based selection for the automatic modes.
  const tier = ROUTING_TO_TIER[routingMode];
  if (tier) {
    const quality = routingMode === "quality_first";
    const picked = pickByTier(eligible, tier, quality);
    if (picked) {
      return resolution(
        picked,
        routingMode,
        `${ROUTING_MODE_LABELS[routingMode]} → ${picked.displayName}`,
      );
    }
  }

  // 4. Fallbacks: org default, then fallback model, then any eligible model.
  const fallback =
    inEligible(orgSettings.defaultModelId) ??
    inEligible(orgSettings.fallbackModelId) ??
    inEligible(employeeSettings?.fallbackModelId ?? null) ??
    eligible[0] ??
    null;

  if (fallback) {
    return resolution(fallback, routingMode, `Fallback selection: ${fallback.displayName}`);
  }

  return resolution(null, routingMode, "No model is available for the current settings.");
}

/** Validate that a specific model supports the required capabilities for a task. */
export function validateModelSupportsTask(
  modelId: string,
  requiredCapabilities: ModelCapability[] | undefined,
): { ok: boolean; reason: string } {
  const model = getModel(modelId);
  if (!model) return { ok: false, reason: "Model not found in the catalog." };
  if (!modelSupportsCapabilities(model, requiredCapabilities)) {
    return {
      ok: false,
      reason: `${model.displayName} does not support all required capabilities.`,
    };
  }
  return { ok: true, reason: "ok" };
}

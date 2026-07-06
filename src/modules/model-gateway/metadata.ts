/**
 * Plain-language labels for the Model Hub UI (Prompt 006B).
 *
 * Normal users should never need to understand LLMs. They pick an Employee Brain
 * mode (Economy / Balanced / Premium / Privacy First); admins can drill into the
 * technical catalog. No user-facing string here uses "agent" or "prompt".
 */

import type { CredentialMode, LlmTaskType, ModelTier, RoutingMode } from "@/lib/db/types";

/** Simple, non-technical modes normal users choose from. */
export type BrainMode = "economy" | "balanced" | "premium" | "privacy_first";

export interface BrainModeMeta {
  id: BrainMode;
  label: string;
  description: string;
  routingMode: RoutingMode;
  /** Preferred model tier when auto-selecting a model for this mode. */
  preferredTier: ModelTier;
}

export const BRAIN_MODES: BrainModeMeta[] = [
  {
    id: "economy",
    label: "Economy",
    description: "Lowest cost. Great for high-volume, everyday tasks.",
    routingMode: "cost_optimized",
    preferredTier: "economy",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "A strong mix of quality, speed, and cost. Recommended default.",
    routingMode: "auto_balanced",
    preferredTier: "balanced",
  },
  {
    id: "premium",
    label: "Premium",
    description: "Highest quality for complex, high-stakes work.",
    routingMode: "quality_first",
    preferredTier: "premium",
  },
  {
    id: "privacy_first",
    label: "Privacy First",
    description: "Prefers open-weight models that can run in private environments.",
    routingMode: "privacy_first",
    preferredTier: "private_open",
  },
];

export const BRAIN_MODES_BY_ID: Record<BrainMode, BrainModeMeta> = Object.fromEntries(
  BRAIN_MODES.map((m) => [m.id, m]),
) as Record<BrainMode, BrainModeMeta>;

/** Map a routing mode back to the brain mode that selects it (if any). */
export function brainModeForRoutingMode(mode: RoutingMode): BrainModeMeta | null {
  return BRAIN_MODES.find((m) => m.routingMode === mode) ?? null;
}

export const ROUTING_MODE_LABELS: Record<RoutingMode, string> = {
  auto_balanced: "Balanced (automatic)",
  cost_optimized: "Economy (lowest cost)",
  quality_first: "Premium (highest quality)",
  privacy_first: "Privacy First (open models)",
  provider_locked: "Locked to one provider",
  manual: "Manual (fixed model)",
};

export const TIER_LABELS: Record<ModelTier, string> = {
  economy: "Economy",
  balanced: "Balanced",
  premium: "Premium",
  realtime: "Realtime",
  private_open: "Privacy / Open",
  coding: "Coding",
  reasoning: "Reasoning",
};

export const CREDENTIAL_MODE_LABELS: Record<CredentialMode, string> = {
  taurus_managed: "Taurus managed",
  bring_your_own_key: "Your own key",
  disabled: "Disabled",
};

/** Friendly, non-technical labels for usage task types (no jargon in the UI). */
export const TASK_TYPE_LABELS: Record<LlmTaskType, string> = {
  employee_chat: "Employee conversation",
  rag_answer: "Knowledge answer",
  dna_summary: "Employee DNA summary",
  knowledge_summary: "Knowledge summary",
  classification: "Classification",
  tool_planning: "Task planning",
  internal_collaboration: "Internal collaboration",
  voice_realtime: "Voice (realtime)",
  system_test: "System test",
};

/** Ordered tiers to prefer when a mode's preferred tier has no available model. */
export const TIER_FALLBACK_ORDER: Record<ModelTier, ModelTier[]> = {
  economy: ["economy", "balanced", "private_open", "premium"],
  balanced: ["balanced", "premium", "economy", "reasoning"],
  premium: ["premium", "reasoning", "balanced", "economy"],
  realtime: ["realtime", "balanced", "premium"],
  private_open: ["private_open", "economy", "balanced"],
  coding: ["coding", "reasoning", "balanced", "premium"],
  reasoning: ["reasoning", "premium", "balanced"],
};

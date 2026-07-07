/**
 * Plans catalog (Prompt 011) — code-authoritative, like the Model Hub catalog.
 *
 * This is the ONE place plan prices and entitlements live. No price is hard-coded
 * anywhere else in the codebase. Every organization is on exactly one of these
 * plans; a new organization starts on Starter (Free) automatically.
 *
 * Entitlements are hard limits enforced server-side (see entitlements.ts). The
 * interaction quota is a monthly count of billable AI Employee interactions
 * (chat + channels), derived from existing usage events — never a parallel
 * counter.
 *
 * Pure module: no Next.js, no DataStore, no env. Safe to import anywhere,
 * including client components (it carries no secrets — Stripe Price ids are read
 * from server-only env at checkout time, keyed by `stripePriceEnvVar`).
 */

export const PLAN_IDS = ["starter", "growth", "scale"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/**
 * What happens when a plan's monthly interaction quota is exceeded:
 *   - "block"     — the next interaction is refused with an upgrade message.
 *   - "soft_cap"  — interactions keep working, but a notice is surfaced.
 */
export type OverageBehavior = "block" | "soft_cap";

/** Hard entitlements for a plan. */
export interface PlanEntitlements {
  /** Max active (non-archived) AI Employees the organization may have. */
  maxEmployees: number;
  /** Max Knowledge Vault sources. */
  maxKnowledgeSources: number;
  /** Max connections (deployment channels across all Employees). */
  maxConnections: number;
  /** Monthly billable AI Employee interactions across chat + channels. */
  monthlyInteractionQuota: number;
}

export interface Plan {
  id: PlanId;
  /** Customer-facing name (Taurus terminology). */
  name: string;
  /** One-line positioning shown on the plans page. */
  tagline: string;
  /** Monthly price in whole US dollars. Starter is 0 (Free). */
  monthlyPriceUsd: number;
  /** True for the free tier (no card required). */
  isFree: boolean;
  entitlements: PlanEntitlements;
  overageBehavior: OverageBehavior;
  /**
   * Name of the server-only env var holding this plan's Stripe Price id. Null for
   * the free tier (no checkout). The value is read only on the server at checkout
   * time and is never bundled into a plan object.
   */
  stripePriceEnvVar: string | null;
  /** Short, human feature bullets for the plans page. */
  highlights: string[];
}

/**
 * The three tiers. Ordered from lowest to highest so `PLANS` doubles as the
 * upgrade ladder. Prices/entitlements are intentionally SMB-shaped.
 */
export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Everything you need to put your first AI Employees to work.",
    monthlyPriceUsd: 0,
    isFree: true,
    entitlements: {
      maxEmployees: 2,
      maxKnowledgeSources: 5,
      maxConnections: 1,
      monthlyInteractionQuota: 200,
    },
    overageBehavior: "block",
    stripePriceEnvVar: null,
    highlights: [
      "Up to 2 active AI Employees",
      "5 Knowledge Vault sources",
      "1 connection",
      "200 AI Employee interactions / month",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    tagline: "Scale your team of AI Employees across every channel.",
    monthlyPriceUsd: 49,
    isFree: false,
    entitlements: {
      maxEmployees: 10,
      maxKnowledgeSources: 50,
      maxConnections: 10,
      monthlyInteractionQuota: 5_000,
    },
    overageBehavior: "block",
    stripePriceEnvVar: "STRIPE_PRICE_GROWTH",
    highlights: [
      "Up to 10 active AI Employees",
      "50 Knowledge Vault sources",
      "10 connections",
      "5,000 AI Employee interactions / month",
    ],
  },
  scale: {
    id: "scale",
    name: "Scale",
    tagline: "High-volume automation with room to grow.",
    monthlyPriceUsd: 199,
    isFree: false,
    entitlements: {
      maxEmployees: 50,
      maxKnowledgeSources: 500,
      maxConnections: 50,
      monthlyInteractionQuota: 50_000,
    },
    // Scale never hard-blocks mid-conversation; it soft-caps with a notice so a
    // busy customer is never left stranded, then follows up to upgrade.
    overageBehavior: "soft_cap",
    stripePriceEnvVar: "STRIPE_PRICE_SCALE",
    highlights: [
      "Up to 50 active AI Employees",
      "500 Knowledge Vault sources",
      "50 connections",
      "50,000 AI Employee interactions / month",
    ],
  },
};

/** The plans in display / upgrade order (lowest tier first). */
export const PLANS_IN_ORDER: Plan[] = PLAN_IDS.map((id) => PLANS[id]);

/** The default plan every new organization starts on (no card required). */
export const DEFAULT_PLAN_ID: PlanId = "starter";

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/** Look up a plan, falling back to Starter for an unknown id (deny-by-default). */
export function getPlan(planId: string | null | undefined): Plan {
  if (planId && isPlanId(planId)) return PLANS[planId];
  return PLANS[DEFAULT_PLAN_ID];
}

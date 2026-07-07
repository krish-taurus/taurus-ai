/**
 * Entitlement enforcement math (Sprint 015) — pure.
 *
 * These functions decide whether an organization may take an action given its
 * current plan and current usage. They are pure (no DataStore, no Next.js) so the
 * limit math is unit-testable in isolation. The server-side callers in
 * service.ts gather the live counts, call these, and turn a blocked decision into
 * a clear, human, upgrade-oriented message (Taurus voice — no error codes).
 *
 * Client gating is never trusted alone: every mutation/runtime point re-runs
 * these checks server-side with a snapshot resolved from the session's
 * organization.
 */

import type { Plan, PlanFeature } from "@/modules/billing/plans";

/**
 * A point-in-time view of an organization's plan and consumption. Counts are
 * gathered from existing data (employees, knowledge sources, connections, and
 * usage events) — the interaction count in particular is DERIVED from usage
 * events, never a separate counter.
 */
export interface EntitlementSnapshot {
  plan: Plan;
  /** Active (non-archived) AI Employees. */
  activeEmployees: number;
  /** Knowledge Vault sources (non-archived). */
  knowledgeSources: number;
  /** Connections (non-archived deployment channels). */
  connections: number;
  /** Billable AI Employee interactions in the current billing period. */
  interactionsThisPeriod: number;
}

export interface EntitlementDecision {
  /** Whether the action is permitted right now. */
  allowed: boolean;
  /** Current usage of the relevant resource. */
  used: number;
  /** The plan's hard limit for the relevant resource. */
  limit: number;
  /**
   * True when the organization is over a soft-cap plan's quota: the action is
   * still allowed, but a notice should be surfaced. Only ever set for the
   * interaction quota on plans whose overage behavior is "soft_cap".
   */
  softCapped?: boolean;
  /**
   * A clear, human, upgrade-oriented message when blocked (or a soft-cap notice).
   * Undefined when comfortably within limits.
   */
  reason?: string;
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

/**
 * Whether a plan includes an on/off feature (BYOK, performance reviews, …).
 * Pure and deny-by-default: an undefined flag is treated as off. Runtime gates
 * (e.g. the Model Hub BYOK server action) call this before allowing the feature.
 */
export function planIncludesFeature(plan: Plan, feature: PlanFeature): boolean {
  return plan.features[feature] === true;
}

/** Can this organization hire (create) another AI Employee? */
export function canHireEmployee(snapshot: EntitlementSnapshot): EntitlementDecision {
  const limit = snapshot.plan.entitlements.maxEmployees;
  const used = snapshot.activeEmployees;
  if (used < limit) return { allowed: true, used, limit };
  return {
    allowed: false,
    used,
    limit,
    reason:
      `You've reached your plan's limit of ${plural(limit, "AI Employee")}. ` +
      `Upgrade your plan to hire more.`,
  };
}

/** Can this organization add another Knowledge Vault source? */
export function canAddKnowledgeSource(snapshot: EntitlementSnapshot): EntitlementDecision {
  const limit = snapshot.plan.entitlements.maxKnowledgeSources;
  const used = snapshot.knowledgeSources;
  if (used < limit) return { allowed: true, used, limit };
  return {
    allowed: false,
    used,
    limit,
    reason:
      `You've reached your plan's limit of ${plural(limit, "Knowledge Vault source")}. ` +
      `Upgrade your plan to add more.`,
  };
}

/** Can this organization add another connection? */
export function canAddConnection(snapshot: EntitlementSnapshot): EntitlementDecision {
  const limit = snapshot.plan.entitlements.maxConnections;
  const used = snapshot.connections;
  if (used < limit) return { allowed: true, used, limit };
  return {
    allowed: false,
    used,
    limit,
    reason:
      `You've reached your plan's limit of ${plural(limit, "connection")}. ` +
      `Upgrade your plan to connect more.`,
  };
}

/**
 * Is this organization within its monthly interaction quota for the next
 * billable interaction? On a "block" plan, going over refuses the interaction.
 * On a "soft_cap" plan, it stays allowed but flags a notice.
 */
export function withinInteractionQuota(snapshot: EntitlementSnapshot): EntitlementDecision {
  const limit = snapshot.plan.entitlements.monthlyInteractionQuota;
  const used = snapshot.interactionsThisPeriod;
  if (used < limit) return { allowed: true, used, limit };

  if (snapshot.plan.overageBehavior === "soft_cap") {
    return {
      allowed: true,
      used,
      limit,
      softCapped: true,
      reason:
        `You've passed your monthly ${limit.toLocaleString()} AI Employee interactions. ` +
        `Your Employees keep working — upgrade your plan for more headroom.`,
    };
  }

  return {
    allowed: false,
    used,
    limit,
    reason:
      `You've used all ${limit.toLocaleString()} AI Employee interactions in your plan this month. ` +
      `Upgrade your plan to keep your Employees working.`,
  };
}

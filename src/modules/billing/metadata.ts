/**
 * Billing metadata + presentation helpers (Prompt 011) — pure.
 *
 * Small, dependency-free helpers shared by the service and UI: subscription
 * status labels, the set of usage-event task types that count as billable
 * interactions, and current-period math. Kept free of Next.js and DataStore.
 */

import type { LlmTaskType } from "@/lib/db/types";

export const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

/** Customer-facing status labels (never surface raw provider states). */
export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment due",
  canceled: "Canceled",
};

/**
 * The usage-event task types that count as a billable "AI Employee interaction"
 * — the customer-facing quota unit. These are the interaction-generating tasks
 * across chat + channels (typed chat and voice turns). Internal helper tasks
 * (summaries, classification, tool planning) are NOT billed to the customer.
 *
 * The quota is derived by counting these events for the current period — we read
 * what we already emit rather than keeping a parallel counter.
 */
export const BILLABLE_INTERACTION_TASK_TYPES: readonly LlmTaskType[] = [
  "employee_chat",
  "voice_realtime",
];

const BILLABLE_SET = new Set<LlmTaskType>(BILLABLE_INTERACTION_TASK_TYPES);

export function isBillableInteraction(taskType: LlmTaskType): boolean {
  return BILLABLE_SET.has(taskType);
}

/** Label for the quota unit shown in the UI. Never "messages" or "tokens". */
export const INTERACTION_UNIT_LABEL = "AI Employee interactions";

/** Clear banner text shown whenever billing is running without Stripe. */
export const SIMULATED_BILLING_LABEL = "Simulated billing";
export const SIMULATED_BILLING_NOTICE =
  "Simulated billing is on — plan changes apply instantly and no payment is taken.";

/**
 * Advance an ISO timestamp by one month, clamping the day so month lengths never
 * overflow (e.g. Jan 31 → Feb 28). Used to compute a subscription's period end
 * from its start without external date libraries.
 */
export function addOneMonthIso(iso: string): string {
  const start = new Date(iso);
  const target = new Date(start);
  target.setUTCMonth(target.getUTCMonth() + 1);
  // If the day rolled over (e.g. Jan 31 + 1mo = Mar 3), snap back to month end.
  if (target.getUTCDate() < start.getUTCDate()) {
    target.setUTCDate(0);
  }
  return target.toISOString();
}

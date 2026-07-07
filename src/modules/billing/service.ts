/**
 * Billing domain service (Sprint 015) — server only.
 *
 * Orchestrates plan resolution, entitlement enforcement, plan changes, the
 * billing portal, and webhook application over a DataStore + a BillingProvider.
 * Pure enforcement math lives in entitlements.ts; catalog/prices in plans.ts.
 *
 * SECURITY: every function is organization-scoped by an id resolved from the
 * session (callers pass it, never the client). Entitlement checks re-run here on
 * the server at each enforcement point. Billing + audit events store metadata
 * only — never card data, customer email, or raw provider payloads.
 */

import type { DataStore } from "@/lib/db/store";
import type { BillingSubscription, BillingSubscriptionStatus } from "@/lib/db/types";
import type { Plan, PlanId } from "@/modules/billing/plans";
import { DEFAULT_PLAN_ID, getPlan, PLANS } from "@/modules/billing/plans";
import {
  canAddConnection,
  canAddKnowledgeSource,
  canHireEmployee,
  withinInteractionQuota,
  type EntitlementDecision,
  type EntitlementSnapshot,
} from "@/modules/billing/entitlements";
import { addOneMonthIso, INTERACTION_UNIT_LABEL } from "@/modules/billing/metadata";
import type { BillingProvider, BillingWebhookEvent } from "@/modules/billing/providers/types";

/** Thrown when an entitlement limit blocks an action. Message is UI-safe. */
export class EntitlementError extends Error {
  constructor(
    message: string,
    readonly decision: EntitlementDecision,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export interface BillingActor {
  organizationId: string;
  userId: string;
}

/**
 * Ensure the organization has a subscription, creating an implicit Starter one
 * if missing. Organizations created through the normal flow already have one;
 * this is a safety net for any org that predates billing.
 */
export async function ensureSubscription(
  store: DataStore,
  organizationId: string,
): Promise<BillingSubscription> {
  const existing = await store.getBillingSubscription(organizationId);
  if (existing) return existing;
  return store.createBillingSubscription({
    organizationId,
    planId: DEFAULT_PLAN_ID,
    status: "active",
    provider: "simulated",
  });
}

/** Resolve the organization's current Plan (deny-by-default to Starter). */
export async function getOrganizationPlan(store: DataStore, organizationId: string): Promise<Plan> {
  const subscription = await ensureSubscription(store, organizationId);
  return getPlan(subscription.planId);
}

/** Gather the live entitlement snapshot from existing organization data. */
export async function buildEntitlementSnapshot(
  store: DataStore,
  organizationId: string,
): Promise<EntitlementSnapshot> {
  const subscription = await ensureSubscription(store, organizationId);
  const plan = getPlan(subscription.planId);

  const [employees, knowledgeSources, connections, interactionsThisPeriod] = await Promise.all([
    store.listEmployees(organizationId),
    store.listKnowledgeSources(organizationId),
    store.listEmployeeChannelsForOrganization(organizationId),
    store.countBillableInteractionsSince(organizationId, subscription.currentPeriodStart),
  ]);

  return {
    plan,
    activeEmployees: employees.filter((e) => e.status !== "archived").length,
    knowledgeSources: knowledgeSources.filter((s) => s.status !== "archived").length,
    connections: connections.filter((c) => c.status !== "archived").length,
    interactionsThisPeriod,
  };
}

// --- Enforcement helpers ----------------------------------------------------
// Each gathers the snapshot, runs the pure check, and throws a friendly
// EntitlementError when blocked. Callers surface `error.message` directly.

export async function assertCanHireEmployee(
  store: DataStore,
  organizationId: string,
): Promise<void> {
  const snapshot = await buildEntitlementSnapshot(store, organizationId);
  const decision = canHireEmployee(snapshot);
  if (!decision.allowed) throw new EntitlementError(decision.reason!, decision);
}

export async function assertCanAddKnowledgeSource(
  store: DataStore,
  organizationId: string,
): Promise<void> {
  const snapshot = await buildEntitlementSnapshot(store, organizationId);
  const decision = canAddKnowledgeSource(snapshot);
  if (!decision.allowed) throw new EntitlementError(decision.reason!, decision);
}

export async function assertCanAddConnection(
  store: DataStore,
  organizationId: string,
): Promise<void> {
  const snapshot = await buildEntitlementSnapshot(store, organizationId);
  const decision = canAddConnection(snapshot);
  if (!decision.allowed) throw new EntitlementError(decision.reason!, decision);
}

/**
 * Check the interaction quota before generating an AI Employee reply. Returns
 * the decision so a soft-cap notice can be recorded; throws EntitlementError
 * only when a "block" plan is over quota.
 */
export async function assertWithinInteractionQuota(
  store: DataStore,
  organizationId: string,
): Promise<EntitlementDecision> {
  const snapshot = await buildEntitlementSnapshot(store, organizationId);
  const decision = withinInteractionQuota(snapshot);
  if (!decision.allowed) throw new EntitlementError(decision.reason!, decision);
  return decision;
}

// --- Overview (dashboard) ---------------------------------------------------

export interface EntitlementUsage {
  label: string;
  used: number;
  limit: number;
  /** 0–100 for a progress bar. */
  percent: number;
}

export interface BillingOverview {
  plan: Plan;
  subscription: BillingSubscription;
  snapshot: EntitlementSnapshot;
  /** True when running without Stripe (simulated mode). */
  simulated: boolean;
  usage: {
    employees: EntitlementUsage;
    knowledgeSources: EntitlementUsage;
    connections: EntitlementUsage;
    interactions: EntitlementUsage;
  };
}

function usage(label: string, used: number, limit: number): EntitlementUsage {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return { label, used, limit, percent };
}

export async function getBillingOverview(
  store: DataStore,
  organizationId: string,
  provider: BillingProvider,
): Promise<BillingOverview> {
  const subscription = await ensureSubscription(store, organizationId);
  const snapshot = await buildEntitlementSnapshot(store, organizationId);
  const plan = snapshot.plan;
  const ent = plan.entitlements;
  return {
    plan,
    subscription,
    snapshot,
    simulated: provider.mode === "simulated",
    usage: {
      employees: usage("AI Employees", snapshot.activeEmployees, ent.maxEmployees),
      knowledgeSources: usage(
        "Knowledge Vault sources",
        snapshot.knowledgeSources,
        ent.maxKnowledgeSources,
      ),
      connections: usage("Connections", snapshot.connections, ent.maxConnections),
      interactions: usage(
        INTERACTION_UNIT_LABEL,
        snapshot.interactionsThisPeriod,
        ent.monthlyInteractionQuota,
      ),
    },
  };
}

// --- Plan changes -----------------------------------------------------------

export type PlanChangeResult =
  /** Simulated (or free) change applied immediately. */
  | { kind: "applied"; subscription: BillingSubscription }
  /** Live checkout — redirect the customer to Stripe. */
  | { kind: "redirect"; url: string };

/**
 * Apply a plan change directly to the store (simulated upgrades and free
 * downgrades). Emits a billing event + audit event with metadata only.
 */
async function applyPlanChange(
  store: DataStore,
  actor: BillingActor,
  planId: PlanId,
  options: { provider: string; status?: BillingSubscriptionStatus; resetPeriod?: boolean } = {
    provider: "simulated",
  },
): Promise<BillingSubscription> {
  const existing = await ensureSubscription(store, actor.organizationId);
  const previousPlanId = existing.planId;

  const patch: Parameters<DataStore["updateBillingSubscription"]>[1] = {
    planId,
    status: options.status ?? "active",
    provider: options.provider,
    cancelAtPeriodEnd: false,
  };
  if (options.resetPeriod) {
    const start = new Date().toISOString();
    patch.currentPeriodStart = start;
    patch.currentPeriodEnd = addOneMonthIso(start);
  }
  const updated = (await store.updateBillingSubscription(actor.organizationId, patch)) ?? existing;

  const upgraded =
    PLANS[planId].monthlyPriceUsd >= PLANS[getPlanId(previousPlanId)].monthlyPriceUsd;
  await store.createBillingEvent({
    organizationId: actor.organizationId,
    eventType: upgraded ? "subscription.upgraded" : "subscription.downgraded",
    planId,
    status: updated.status,
    provider: options.provider,
    metadata: { previousPlanId, newPlanId: planId, via: options.provider },
  });
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: upgraded ? "billing.plan_upgraded" : "billing.plan_downgraded",
    targetType: "billing_subscription",
    targetId: updated.id,
    metadata: { previousPlanId, newPlanId: planId, via: options.provider },
  });
  return updated;
}

function getPlanId(value: string): PlanId {
  return getPlan(value).id;
}

/**
 * Start a plan change. In simulated mode (or for the free Starter plan), the
 * change is applied immediately. In live mode for a paid plan, a Stripe Checkout
 * session is created and the caller redirects to it.
 */
export async function startPlanChange(
  store: DataStore,
  actor: BillingActor,
  provider: BillingProvider,
  planId: PlanId,
  urls: { successUrl: string; cancelUrl: string },
): Promise<PlanChangeResult> {
  const targetPlan = PLANS[planId];
  const customer = await store.getBillingCustomer(actor.organizationId);

  const checkout = await provider.createCheckoutSession({
    organizationId: actor.organizationId,
    planId,
    externalCustomerId: customer?.externalCustomerId ?? null,
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
  });

  if (checkout.mode === "simulated") {
    const subscription = await applyPlanChange(store, actor, planId, {
      provider: "simulated",
      resetPeriod: true,
    });
    return { kind: "applied", subscription };
  }

  // Live mode. A move to the free plan never needs Checkout — apply directly.
  if (targetPlan.isFree) {
    const subscription = await applyPlanChange(store, actor, planId, {
      provider: "stripe",
      resetPeriod: true,
    });
    return { kind: "applied", subscription };
  }

  return { kind: "redirect", url: checkout.url };
}

export type PortalResult = { kind: "simulated" } | { kind: "redirect"; url: string };

/** Open the billing management surface (Stripe portal or simulated equivalent). */
export async function openBillingPortal(
  store: DataStore,
  organizationId: string,
  provider: BillingProvider,
  returnUrl: string,
): Promise<PortalResult> {
  const customer = await store.getBillingCustomer(organizationId);
  const session = await provider.createBillingPortalSession({
    organizationId,
    externalCustomerId: customer?.externalCustomerId ?? null,
    returnUrl,
  });
  return session.mode === "simulated"
    ? { kind: "simulated" }
    : { kind: "redirect", url: session.url };
}

// --- Webhook application ----------------------------------------------------

/**
 * Apply a normalized webhook event. The organization is resolved from stored
 * customer/subscription ids ONLY — never from client input. Unknown mappings are
 * ignored (returns false) rather than trusting the payload.
 */
export async function applyWebhookEvent(
  store: DataStore,
  event: BillingWebhookEvent,
): Promise<boolean> {
  if (event.type === "ignored") return false;

  // Resolve the organization from what we already stored.
  let organizationId: string | null = null;
  if (event.externalSubscriptionId) {
    const sub = await store.getBillingSubscriptionByExternalId(event.externalSubscriptionId);
    if (sub) organizationId = sub.organizationId;
  }
  if (!organizationId && event.externalCustomerId) {
    const customer = await store.getBillingCustomerByExternalId(event.externalCustomerId);
    if (customer) organizationId = customer.organizationId;
  }
  if (!organizationId) return false;

  const patch: Parameters<DataStore["updateBillingSubscription"]>[1] = { provider: "stripe" };
  if (event.planId) patch.planId = event.planId;
  if (event.status) patch.status = event.status;
  if (event.cancelAtPeriodEnd !== null) patch.cancelAtPeriodEnd = event.cancelAtPeriodEnd;
  if (event.currentPeriodStart) patch.currentPeriodStart = event.currentPeriodStart;
  if (event.currentPeriodEnd) patch.currentPeriodEnd = event.currentPeriodEnd;
  if (event.externalSubscriptionId) patch.externalSubscriptionId = event.externalSubscriptionId;
  if (event.externalCustomerId) {
    patch.externalCustomerId = event.externalCustomerId;
    await store.upsertBillingCustomer({
      organizationId,
      externalCustomerId: event.externalCustomerId,
      provider: "stripe",
    });
  }

  await store.updateBillingSubscription(organizationId, patch);

  await store.createBillingEvent({
    organizationId,
    eventType: `webhook.${event.type}`,
    planId: event.planId,
    status: event.status,
    provider: "stripe",
    metadata: {
      type: event.type,
      externalEventId: event.externalEventId,
      cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    },
  });
  await store.createAuditEvent({
    organizationId,
    actorType: "system",
    actorId: null,
    action: "billing.webhook_applied",
    targetType: "billing_subscription",
    targetId: null,
    metadata: { type: event.type, status: event.status, planId: event.planId },
  });
  return true;
}

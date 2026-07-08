/**
 * Metered overage (Sprint 017) — server only, ORG-SCOPED.
 *
 * When a MANAGED organization on pay-as-you-go exceeds its period interaction
 * quota, each further billable interaction accrues a metered overage line at the
 * managed per-interaction price (Sprint 016), bounded by an optional spend cap.
 * BYOK and hard-cap orgs never accrue a charge.
 *
 * Interaction counts are always derived from usage events (via the entitlement
 * snapshot) — this module only writes the billing ledger. No card data flows
 * through here; lines are metadata only.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  BillingOverageItem,
  BillingSubscription,
  ModelAccessMode,
  OveragePolicy,
} from "@/lib/db/types";
import { isOveragePolicy } from "@/lib/db/types";
import { managedInteractionPriceUsd } from "@/modules/usage/model-pricing";
import { getBillingProvider } from "@/modules/billing/providers";
import type { BillingProvider } from "@/modules/billing/providers/types";

/** The managed per-interaction overage rate (a single, disclosed rate). */
export function overageUnitPriceUsd(): number {
  return managedInteractionPriceUsd("mid");
}

export interface OverageActor {
  organizationId: string;
  userId: string;
}

export class OverageSettingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverageSettingError";
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Sum the accrued overage amount for an org in a subscription period. */
async function sumOveragePeriod(
  store: DataStore,
  organizationId: string,
  periodStart: string,
): Promise<{ quantity: number; amountUsd: number; items: BillingOverageItem[] }> {
  const items = await store.listBillingOverageItems(organizationId, periodStart);
  const quantity = items.reduce((s, i) => s + i.quantity, 0);
  const amountUsd = round2(items.reduce((s, i) => s + i.amountUsd, 0));
  return { quantity, amountUsd, items };
}

export interface OverageAccrualResult {
  /** True when the over-quota interaction may proceed (it was metered). */
  allowed: boolean;
  /** A clear, human message when blocked (hard cap / cap reached / not eligible). */
  reason?: string;
  /** The overage line that was written, when allowed. */
  item?: BillingOverageItem;
}

/**
 * Decide whether an over-quota interaction may proceed by metering it. Called by
 * the enforcement path ONLY when the org is already over quota on a block plan.
 * Records an overage line for a managed pay-as-you-go org under its spend cap;
 * otherwise returns not-allowed (the caller blocks).
 */
export async function tryAccrueOverage(
  store: DataStore,
  organizationId: string,
  subscription: BillingSubscription,
  accessMode: ModelAccessMode,
): Promise<OverageAccrualResult> {
  // Only a managed org on pay-as-you-go is ever metered. BYOK + hard-cap block.
  if (accessMode !== "managed" || subscription.overagePolicy !== "pay_as_you_go") {
    return { allowed: false };
  }

  const unitPrice = overageUnitPriceUsd();
  const { amountUsd: accrued } = await sumOveragePeriod(
    store,
    organizationId,
    subscription.currentPeriodStart,
  );

  // Spend cap: once reached, revert to hard-cap for the rest of the period. Never
  // record a line that would push the bill past the cap.
  if (
    subscription.overageSpendCapUsd != null &&
    round2(accrued + unitPrice) > subscription.overageSpendCapUsd
  ) {
    return {
      allowed: false,
      reason:
        `You've reached your monthly overage spend cap of ` +
        `$${subscription.overageSpendCapUsd.toFixed(2)}. Interactions are paused until the ` +
        `next period, or an owner can raise the cap.`,
    };
  }

  const provider = getBillingProvider();
  const item = await store.createBillingOverageItem({
    organizationId,
    periodStart: subscription.currentPeriodStart,
    quantity: 1,
    unitPriceUsd: unitPrice,
    amountUsd: unitPrice,
    provider: provider.mode,
    status: "pending",
  });
  return { allowed: true, item };
}

// --- Customer-facing summary --------------------------------------------------

export interface OverageSummary {
  policy: OveragePolicy;
  /** True only for a managed org (pay-as-you-go is offered). */
  eligible: boolean;
  unitPriceUsd: number;
  spendCapUsd: number | null;
  quantityThisPeriod: number;
  amountThisPeriodUsd: number;
  /** True when the spend cap has been reached (further interactions hard-cap). */
  capReached: boolean;
  /** True in simulated mode — accrued + displayed but never charged. */
  simulated: boolean;
}

export async function getOverageSummary(
  store: DataStore,
  organizationId: string,
  accessMode: ModelAccessMode,
  subscription: BillingSubscription,
  provider: BillingProvider,
): Promise<OverageSummary> {
  const unitPrice = overageUnitPriceUsd();
  const { quantity, amountUsd } = await sumOveragePeriod(
    store,
    organizationId,
    subscription.currentPeriodStart,
  );
  const capReached =
    subscription.overageSpendCapUsd != null &&
    round2(amountUsd + unitPrice) > subscription.overageSpendCapUsd;
  return {
    policy: subscription.overagePolicy,
    eligible: accessMode === "managed",
    unitPriceUsd: unitPrice,
    spendCapUsd: subscription.overageSpendCapUsd,
    quantityThisPeriod: quantity,
    amountThisPeriodUsd: amountUsd,
    capReached,
    simulated: provider.mode === "simulated",
  };
}

// --- Owner/admin settings (audited; permission enforced in the action) --------

export async function setOveragePolicy(
  store: DataStore,
  actor: OverageActor,
  policy: unknown,
): Promise<BillingSubscription> {
  if (!isOveragePolicy(policy)) throw new OverageSettingError("Choose a valid overage option.");
  const [org, subscription] = await Promise.all([
    store.getOrganizationById(actor.organizationId),
    store.getBillingSubscription(actor.organizationId),
  ]);
  if (!org || !subscription) throw new OverageSettingError("Organization not found.");

  if (policy === "pay_as_you_go") {
    // Only managed orgs may enable pay-as-you-go (BYOK pays their provider).
    if (org.modelAccessMode !== "managed") {
      throw new OverageSettingError(
        "Pay as you go is only available in managed mode. Bring-your-own-key organizations " +
          "pay their provider directly.",
      );
    }
    // In live billing a payment method is required; simulated mode never charges.
    const provider = getBillingProvider();
    if (provider.mode === "stripe" && !subscription.externalCustomerId) {
      throw new OverageSettingError("Add a payment method before enabling pay as you go.");
    }
  }

  if (subscription.overagePolicy === policy) return subscription;
  const updated =
    (await store.updateBillingSubscription(actor.organizationId, { overagePolicy: policy })) ??
    subscription;
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "billing.overage_policy_changed",
    targetType: "billing_subscription",
    targetId: subscription.id,
    metadata: { previous: subscription.overagePolicy, next: policy },
  });
  return updated;
}

export async function setOverageSpendCap(
  store: DataStore,
  actor: OverageActor,
  capUsd: number | null,
): Promise<BillingSubscription> {
  if (capUsd != null && (!Number.isFinite(capUsd) || capUsd < 0)) {
    throw new OverageSettingError("Enter a spend cap of $0 or more, or leave it blank for no cap.");
  }
  const subscription = await store.getBillingSubscription(actor.organizationId);
  if (!subscription) throw new OverageSettingError("Organization not found.");
  const normalized = capUsd == null ? null : round2(capUsd);
  if (subscription.overageSpendCapUsd === normalized) return subscription;
  const updated =
    (await store.updateBillingSubscription(actor.organizationId, {
      overageSpendCapUsd: normalized,
    })) ?? subscription;
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "billing.overage_cap_changed",
    targetType: "billing_subscription",
    targetId: subscription.id,
    metadata: { previous: subscription.overageSpendCapUsd, next: normalized },
  });
  return updated;
}

// --- Provider reporting + reconciliation --------------------------------------

/**
 * Report the period's pending overage to the provider so it is billed on invoice
 * finalization. Simulated mode is a no-op (lines stay pending, never charged).
 * Marks reported lines so they aren't double-reported.
 */
export async function reportPeriodOverage(
  store: DataStore,
  provider: BillingProvider,
  organizationId: string,
  subscription: BillingSubscription,
): Promise<{ reported: number; mode: BillingProvider["mode"] }> {
  const items = await store.listBillingOverageItems(
    organizationId,
    subscription.currentPeriodStart,
  );
  const pending = items.filter((i) => i.status === "pending");
  const quantity = pending.reduce((s, i) => s + i.quantity, 0);
  if (quantity === 0) return { reported: 0, mode: provider.mode };

  const report = await provider.reportOverageUsage({
    externalSubscriptionId: subscription.externalSubscriptionId,
    externalCustomerId: subscription.externalCustomerId,
    quantity,
    periodStart: subscription.currentPeriodStart,
  });
  if (report.mode === "simulated") {
    // Nothing is charged; leave the lines pending + labeled simulated.
    return { reported: 0, mode: "simulated" };
  }
  const reported = await store.markBillingOverageItemsStatus(
    organizationId,
    subscription.currentPeriodStart,
    "pending",
    "reported",
    report.externalUsageRecordId,
  );
  return { reported, mode: "stripe" };
}

/**
 * Reconcile after the provider bills the invoice: mark the period's reported
 * overage as charged. Called from the invoice.finalized webhook path.
 */
export async function reconcileChargedOverage(
  store: DataStore,
  organizationId: string,
  periodStart: string,
): Promise<number> {
  return store.markBillingOverageItemsStatus(
    organizationId,
    periodStart,
    "reported",
    "charged",
    null,
  );
}

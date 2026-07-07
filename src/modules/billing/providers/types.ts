/**
 * Billing provider adapter interface (Prompt 011).
 *
 * Mirrors the model-gateway / messaging provider pattern: the service talks to a
 * `BillingProvider`, never to Stripe directly. Two implementations exist — a real
 * `StripeBillingProvider` and a `SimulatedBillingProvider` — selected by env in
 * providers/index.ts. Simulated mode is used whenever STRIPE_SECRET_KEY is
 * absent, so local dev and tests never touch the network.
 *
 * No card data ever flows through these types. Checkout and portal are hosted by
 * Stripe; Taurus only ever holds opaque external ids.
 */

import type { PlanId } from "@/modules/billing/plans";
import type { BillingSubscriptionStatus } from "@/lib/db/types";

/** Result of starting a plan change. */
export type CheckoutSession =
  /** Simulated mode: the service applies the plan change immediately. */
  | { mode: "simulated"; planId: PlanId }
  /** Live mode: redirect the customer to Stripe Checkout. */
  | { mode: "redirect"; url: string };

/** Result of opening the billing management surface. */
export type PortalSession = { mode: "simulated" } | { mode: "redirect"; url: string };

export interface CreateCheckoutInput {
  organizationId: string;
  planId: PlanId;
  /** Existing external customer id, if the org already has one. */
  externalCustomerId: string | null;
  /** Absolute URLs Stripe returns the customer to. */
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePortalInput {
  organizationId: string;
  externalCustomerId: string | null;
  returnUrl: string;
}

/** A normalized billing event, decoupled from any provider's payload shape. */
export type BillingWebhookEventType =
  | "checkout.completed"
  | "subscription.updated"
  | "subscription.deleted"
  | "payment.failed"
  | "ignored";

export interface BillingWebhookEvent {
  type: BillingWebhookEventType;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  /** Resolved from the provider's price id, when derivable. */
  planId: PlanId | null;
  status: BillingSubscriptionStatus | null;
  cancelAtPeriodEnd: boolean | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  /** Opaque provider event id (metadata only). */
  externalEventId: string | null;
}

/** A minimal status snapshot used to reconcile a subscription. */
export interface ExternalSubscriptionStatus {
  externalSubscriptionId: string;
  planId: PlanId | null;
  status: BillingSubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

export interface BillingProvider {
  /** "stripe" | "simulated" — surfaced to the UI so simulated mode is labeled. */
  readonly mode: "stripe" | "simulated";

  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  createBillingPortalSession(input: CreatePortalInput): Promise<PortalSession>;

  /** Verify a webhook signature. Returns true when trusted (or when unsigned in simulated mode). */
  verifyWebhook(payload: string, signature: string | null): Promise<boolean>;
  /** Parse a raw webhook body into a normalized event. Returns null if unparseable. */
  parseWebhookEvent(payload: string): BillingWebhookEvent | null;

  /** Fetch current status for a live subscription (null in simulated mode). */
  getSubscriptionStatus(externalSubscriptionId: string): Promise<ExternalSubscriptionStatus | null>;
}

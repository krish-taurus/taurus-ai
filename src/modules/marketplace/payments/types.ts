/**
 * Marketplace payment provider adapter (Sprint 034).
 *
 * Mirrors the billing-provider pattern: the marketplace service talks to a
 * `MarketplacePaymentProvider`, never to Stripe/Razorpay directly. Three
 * implementations exist — Stripe (Checkout), Razorpay (Payment Links), and a
 * Simulated provider selected when no live keys are configured. Simulated mode
 * completes the purchase in-process, so local dev and tests never touch the
 * network and never charge.
 *
 * No card data ever flows through these types. Checkout is hosted by the
 * provider; Taurus only ever holds opaque ids and its own reconciliation
 * reference.
 */

import type { MarketplacePaymentProviderId } from "@/lib/db/types";

export interface CreateCheckoutInput {
  /** Our opaque reconciliation reference (the payment row's `reference`). */
  reference: string;
  amount: number; // minor units, > 0
  currency: string; // ISO 4217 lower, e.g. "usd" | "inr"
  /** Human-facing line-item name shown on the hosted checkout. */
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutResult =
  /** Simulated mode: the service fulfills the purchase immediately, no redirect. */
  | { mode: "simulated" }
  /** Live mode: redirect the buyer to the hosted checkout. */
  | { mode: "redirect"; url: string; externalPaymentId: string | null };

/** A normalized payment event, decoupled from any provider's payload shape. */
export type PaymentWebhookEventType = "paid" | "failed" | "ignored";

export interface PaymentWebhookEvent {
  type: PaymentWebhookEventType;
  /** Our reconciliation reference, echoed back by the provider. */
  reference: string | null;
  /** The provider's payment/session/link id. */
  externalPaymentId: string | null;
}

export interface MarketplacePaymentProvider {
  readonly id: MarketplacePaymentProviderId;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  /** Verify a webhook signature. True when trusted (or unsigned in simulated mode). */
  verifyWebhook(payload: string, signature: string | null): Promise<boolean>;
  /** Parse a raw webhook body into a normalized event. Null if unparseable. */
  parseWebhookEvent(payload: string): PaymentWebhookEvent | null;
}

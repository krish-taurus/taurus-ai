/**
 * Billing provider selection (Sprint 015) — server only.
 *
 * Simulated mode is the default: unless STRIPE_SECRET_KEY is set we use the
 * SimulatedBillingProvider, so local dev and tests never make a network call and
 * never charge — even if keys exist for other services. The secret key and
 * webhook secret are read only here, never exposed to the client, and never
 * prefixed NEXT_PUBLIC_.
 */

import type { BillingProvider } from "@/modules/billing/providers/types";
import { SimulatedBillingProvider } from "@/modules/billing/providers/simulated";
import { StripeBillingProvider } from "@/modules/billing/providers/stripe";

/** True when live Stripe billing is configured (a secret key is present). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True when billing is running in simulated mode (no Stripe key). */
export function isSimulatedBilling(): boolean {
  return !isStripeConfigured();
}

let cached: BillingProvider | null = null;

/**
 * Resolve the active billing provider. Cached per process. Absent Stripe keys
 * always yield the simulated provider — this is the deny-by-default that keeps
 * Taurus from ever charging without an explicit live configuration.
 */
export function getBillingProvider(): BillingProvider {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey) {
    cached = new StripeBillingProvider({
      secretKey,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    });
  } else {
    cached = new SimulatedBillingProvider();
  }
  return cached;
}

/** Test helper: reset the cached provider between tests. */
export function __resetBillingProviderForTests(provider?: BillingProvider): void {
  cached = provider ?? null;
}

export type { BillingProvider };

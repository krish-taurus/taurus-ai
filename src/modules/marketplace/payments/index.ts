/**
 * Marketplace payment provider selection + revenue-share math (Sprint 034) —
 * server only.
 *
 * Simulated is the deny-by-default: unless a provider's live keys are present we
 * use the SimulatedPaymentProvider, so local dev and tests never make a network
 * call and never charge — even if a buyer requests a specific provider. Secret
 * keys are read only here, never exposed to the client, and never NEXT_PUBLIC_.
 */

import type { MarketplacePaymentProviderId } from "@/lib/db/types";
import type {
  MarketplacePaymentProvider,
  MarketplacePayoutProvider,
} from "@/modules/marketplace/payments/types";
import { SimulatedPaymentProvider } from "@/modules/marketplace/payments/simulated";
import { StripeMarketplacePaymentProvider } from "@/modules/marketplace/payments/stripe";
import { RazorpayPaymentProvider } from "@/modules/marketplace/payments/razorpay";

const DEFAULT_PLATFORM_FEE_BPS = 1500; // 15%

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/**
 * Live providers a buyer can actually pay through. Empty when nothing is
 * configured — the caller then runs the simulated flow.
 */
export function availablePaymentProviders(): MarketplacePaymentProviderId[] {
  const out: MarketplacePaymentProviderId[] = [];
  if (isStripeConfigured()) out.push("stripe");
  if (isRazorpayConfigured()) out.push("razorpay");
  return out;
}

/**
 * Resolve a payment provider. A requested provider is honored only when its
 * live keys are configured; otherwise we fall back to the simulated provider so
 * we never attempt a charge without a real configuration.
 */
export function getMarketplacePaymentProvider(
  requested?: MarketplacePaymentProviderId,
): MarketplacePaymentProvider {
  if (requested === "stripe" && isStripeConfigured()) {
    return new StripeMarketplacePaymentProvider({
      secretKey: process.env.STRIPE_SECRET_KEY as string,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    });
  }
  if (requested === "razorpay" && isRazorpayConfigured()) {
    return new RazorpayPaymentProvider({
      keyId: process.env.RAZORPAY_KEY_ID as string,
      keySecret: process.env.RAZORPAY_KEY_SECRET as string,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? null,
    });
  }
  return new SimulatedPaymentProvider();
}

/** Resolve the provider that handles inbound webhooks for a given provider id. */
export function getWebhookProvider(
  provider: MarketplacePaymentProviderId,
): MarketplacePaymentProvider {
  return getMarketplacePaymentProvider(provider);
}

/**
 * Resolve a payout provider (Connect/Route). Honors the requested provider only
 * when its live keys are configured; otherwise falls back to simulated so no
 * transfer is ever attempted without a real configuration. The three provider
 * classes implement both the payment and payout interfaces.
 */
export function getMarketplacePayoutProvider(
  requested?: MarketplacePaymentProviderId,
): MarketplacePayoutProvider {
  if (requested === "stripe" && isStripeConfigured()) {
    return new StripeMarketplacePaymentProvider({
      secretKey: process.env.STRIPE_SECRET_KEY as string,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? null,
    });
  }
  if (requested === "razorpay" && isRazorpayConfigured()) {
    return new RazorpayPaymentProvider({
      keyId: process.env.RAZORPAY_KEY_ID as string,
      keySecret: process.env.RAZORPAY_KEY_SECRET as string,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? null,
    });
  }
  return new SimulatedPaymentProvider();
}

/** The platform's revenue-share cut in basis points (0–10000). */
export function platformFeeBps(): number {
  const raw = Number(process.env.MARKETPLACE_PLATFORM_FEE_BPS);
  if (!Number.isFinite(raw)) return DEFAULT_PLATFORM_FEE_BPS;
  return Math.min(10_000, Math.max(0, Math.round(raw)));
}

/**
 * Split a gross amount (minor units) into the platform fee and the seller's net.
 * The fee rounds down so the seller is never short-changed by rounding.
 */
export function computeRevenueSplit(
  amount: number,
  feeBps: number = platformFeeBps(),
): { platformFee: number; sellerNet: number } {
  const safeAmount = Math.max(0, Math.round(amount));
  const platformFee = Math.floor((safeAmount * feeBps) / 10_000);
  return { platformFee, sellerNet: safeAmount - platformFee };
}

export type { MarketplacePaymentProvider, MarketplacePayoutProvider };

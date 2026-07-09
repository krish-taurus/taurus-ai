/**
 * Marketplace payment webhook endpoint (Sprint 034).
 *
 * POST /api/webhooks/marketplace/{provider}   (provider = stripe | razorpay | simulated)
 *
 * No dashboard auth. The signature is verified against the provider's configured
 * secret; the payment is resolved from OUR reconciliation reference (or the
 * provider's payment id) inside the service — never from the body for identity.
 * In simulated mode the request is accepted unsigned so the path is exercisable
 * locally. The raw body is read as text so the signature covers exact bytes.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import type { MarketplacePaymentProviderId } from "@/lib/db/types";
import { getWebhookProvider } from "@/modules/marketplace/payments";
import { fulfillMarketplacePayment } from "@/modules/marketplace/service";

export const dynamic = "force-dynamic";

const KNOWN: MarketplacePaymentProviderId[] = ["stripe", "razorpay", "simulated"];

function signatureFor(provider: MarketplacePaymentProviderId, request: Request): string | null {
  if (provider === "stripe") return request.headers.get("stripe-signature");
  if (provider === "razorpay") return request.headers.get("x-razorpay-signature");
  return null;
}

export async function POST(request: Request, { params }: { params: { provider: string } }) {
  const provider = params.provider as MarketplacePaymentProviderId;
  if (!KNOWN.includes(provider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const paymentProvider = getWebhookProvider(provider);

  const verified = await paymentProvider.verifyWebhook(rawBody, signatureFor(provider, request));
  if (!verified) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = paymentProvider.parseWebhookEvent(rawBody);
  if (!event) {
    return NextResponse.json({ error: "unparseable" }, { status: 400 });
  }

  const result = await fulfillMarketplacePayment(getStore(), provider, event);
  return NextResponse.json(result, { status: 200 });
}

/**
 * Stripe billing webhook endpoint (Prompt 011).
 *
 * POST /api/webhooks/billing/stripe
 *
 * No dashboard auth. The signature is verified against STRIPE_WEBHOOK_SECRET when
 * configured; the organization is resolved from stored customer/subscription ids
 * inside the service — never from the request body. In simulated mode (no Stripe
 * keys) the request is accepted without a signature and applies a JSON envelope,
 * so the webhook path is exercisable locally.
 *
 * The raw request body is read as text so the signature covers the exact bytes.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { getBillingProvider } from "@/modules/billing/providers";
import { processBillingWebhook } from "@/modules/billing/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  const result = await processBillingWebhook(
    getStore(),
    getBillingProvider(),
    rawBody,
    signature,
  );

  return NextResponse.json(result.body, { status: result.status });
}

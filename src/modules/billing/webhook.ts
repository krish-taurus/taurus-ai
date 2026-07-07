/**
 * Billing webhook processing (Sprint 015) — server only.
 *
 * Verifies the signature (when configured), parses the provider payload into a
 * normalized event, and applies it. The organization is always resolved from
 * stored ids inside applyWebhookEvent — never from the request body.
 */

import type { DataStore } from "@/lib/db/store";
import type { BillingProvider } from "@/modules/billing/providers/types";
import { applyWebhookEvent } from "@/modules/billing/service";

export interface WebhookResult {
  status: number;
  body: { received: boolean; applied?: boolean; error?: string };
}

export async function processBillingWebhook(
  store: DataStore,
  provider: BillingProvider,
  rawBody: string,
  signature: string | null,
): Promise<WebhookResult> {
  const verified = await provider.verifyWebhook(rawBody, signature);
  if (!verified) {
    return { status: 400, body: { received: false, error: "invalid signature" } };
  }

  const event = provider.parseWebhookEvent(rawBody);
  if (!event) {
    // Acknowledge unparseable/irrelevant payloads so the provider stops retrying.
    return { status: 200, body: { received: true, applied: false } };
  }

  const applied = await applyWebhookEvent(store, event);
  return { status: 200, body: { received: true, applied } };
}

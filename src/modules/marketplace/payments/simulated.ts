/**
 * Simulated marketplace payment provider (Sprint 034).
 *
 * The default whenever no live provider keys are configured. `createCheckout`
 * returns `{ mode: "simulated" }` so the service fulfills the purchase in-process
 * — no network call, no charge. The webhook path stays exercisable locally: it
 * accepts an unsigned JSON envelope `{ reference, status }`.
 */

import type {
  CheckoutResult,
  MarketplacePaymentProvider,
  PaymentWebhookEvent,
} from "@/modules/marketplace/payments/types";

export class SimulatedPaymentProvider implements MarketplacePaymentProvider {
  readonly id = "simulated" as const;

  async createCheckout(): Promise<CheckoutResult> {
    return { mode: "simulated" };
  }

  async verifyWebhook(_payload: string, _signature: string | null): Promise<boolean> {
    // No signing in simulated mode — accept so the path is exercisable locally.
    return true;
  }

  parseWebhookEvent(payload: string): PaymentWebhookEvent | null {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
    const reference = typeof body.reference === "string" ? body.reference : null;
    const status = typeof body.status === "string" ? body.status : "paid";
    return {
      type: status === "failed" ? "failed" : "paid",
      reference,
      externalPaymentId: typeof body.externalPaymentId === "string" ? body.externalPaymentId : null,
    };
  }
}

/**
 * Simulated billing provider (Sprint 015).
 *
 * The default provider whenever STRIPE_SECRET_KEY is absent (local dev + tests).
 * Never touches the network and never charges: "Upgrade" resolves to an instant
 * plan change that the service applies directly. Clearly labeled "Simulated
 * billing" in the UI.
 */

import type { PlanId } from "@/modules/billing/plans";
import type {
  BillingProvider,
  BillingWebhookEvent,
  CheckoutSession,
  CreateCheckoutInput,
  CreatePortalInput,
  ExternalSubscriptionStatus,
  PortalSession,
} from "@/modules/billing/providers/types";
import { isPlanId } from "@/modules/billing/plans";
import { isSubscriptionStatus } from "@/modules/billing/metadata";
import type { BillingSubscriptionStatus } from "@/lib/db/types";

export class SimulatedBillingProvider implements BillingProvider {
  readonly mode = "simulated" as const;

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    // No network, no charge — the service applies the plan change immediately.
    return { mode: "simulated", planId: input.planId };
  }

  async createBillingPortalSession(_input: CreatePortalInput): Promise<PortalSession> {
    void _input;
    return { mode: "simulated" };
  }

  async verifyWebhook(_payload: string, _signature: string | null): Promise<boolean> {
    void _payload;
    void _signature;
    // No signing secret in simulated mode; the webhook route still resolves the
    // organization from stored ids, never from client-controlled fields.
    return true;
  }

  parseWebhookEvent(payload: string): BillingWebhookEvent | null {
    // Accept a simple JSON envelope for local testing of the webhook path.
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
    const type = typeof body.type === "string" ? body.type : "ignored";
    const planId = isPlanId(body.planId) ? (body.planId as PlanId) : null;
    const status = isSubscriptionStatus(body.status)
      ? (body.status as BillingSubscriptionStatus)
      : null;
    return {
      type:
        type === "checkout.completed" ||
        type === "subscription.updated" ||
        type === "subscription.deleted" ||
        type === "payment.failed"
          ? type
          : "ignored",
      externalCustomerId:
        typeof body.externalCustomerId === "string" ? body.externalCustomerId : null,
      externalSubscriptionId:
        typeof body.externalSubscriptionId === "string" ? body.externalSubscriptionId : null,
      planId,
      status,
      cancelAtPeriodEnd:
        typeof body.cancelAtPeriodEnd === "boolean" ? body.cancelAtPeriodEnd : null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      externalEventId: typeof body.id === "string" ? body.id : null,
    };
  }

  async getSubscriptionStatus(
    _externalSubscriptionId: string,
  ): Promise<ExternalSubscriptionStatus | null> {
    void _externalSubscriptionId;
    return null;
  }
}

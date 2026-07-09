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
  ConnectedAccountResult,
  CreateConnectedAccountInput,
  CreateTransferInput,
  MarketplacePaymentProvider,
  MarketplacePayoutProvider,
  OnboardingLinkResult,
  PaymentWebhookEvent,
  PayoutAccountStatus,
  PayoutWebhookEvent,
  TransferResult,
} from "@/modules/marketplace/payments/types";

export class SimulatedPaymentProvider
  implements MarketplacePaymentProvider, MarketplacePayoutProvider
{
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

  // --- Payouts (Sprint 035) -------------------------------------------------

  async createConnectedAccount(input: CreateConnectedAccountInput): Promise<ConnectedAccountResult> {
    // No hosted onboarding in simulated mode — the account is immediately usable.
    return {
      externalAccountId: `acct_sim_${input.organizationId}`,
      status: "active",
    };
  }

  async createOnboardingLink(): Promise<OnboardingLinkResult> {
    return { mode: "simulated" };
  }

  async getAccountStatus(): Promise<PayoutAccountStatus> {
    return "active";
  }

  async createTransfer(): Promise<TransferResult> {
    return { mode: "simulated" };
  }

  parsePayoutWebhookEvent(payload: string): PayoutWebhookEvent | null {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
    const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
    const status = str(body.status) ?? "paid";
    return {
      type: status === "failed" ? "payout.failed" : "payout.paid",
      externalAccountId: str(body.externalAccountId),
      accountStatus: null,
      reference: str(body.reference),
      externalTransferId: str(body.externalTransferId),
    };
  }
}

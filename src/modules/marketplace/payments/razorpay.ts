/**
 * Razorpay marketplace payment provider (Sprint 034).
 *
 * A dependency-free adapter using Razorpay Payment Links — the simplest hosted
 * checkout: create a link, redirect the buyer to its `short_url`, and reconcile
 * on the `payment_link.paid` webhook. Only constructed when RAZORPAY_KEY_ID +
 * RAZORPAY_KEY_SECRET are set; providers/index.ts falls back to simulated
 * otherwise, so this file is never reached in tests.
 *
 * Card data never touches Taurus. Webhook signatures are verified with the
 * configured webhook secret (HMAC-SHA256 over the raw body, constant-time
 * compared to the `x-razorpay-signature` header).
 */

import crypto from "node:crypto";
import type {
  CheckoutResult,
  ConnectedAccountResult,
  CreateCheckoutInput,
  CreateConnectedAccountInput,
  CreateOnboardingLinkInput,
  CreateTransferInput,
  MarketplacePaymentProvider,
  MarketplacePayoutProvider,
  OnboardingLinkResult,
  PaymentWebhookEvent,
  PayoutAccountStatus,
  PayoutWebhookEvent,
  TransferResult,
} from "@/modules/marketplace/payments/types";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const RAZORPAY_API_BASE_V2 = "https://api.razorpay.com/v2";

export class RazorpayPaymentProvider
  implements MarketplacePaymentProvider, MarketplacePayoutProvider
{
  readonly id = "razorpay" as const;

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string | null;

  constructor(config: { keyId: string; keySecret: string; webhookSecret?: string | null }) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret ?? null;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
  }

  private async razorpayFetch(
    url: string,
    method: "GET" | "POST",
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const init: RequestInit = {
      method,
      headers: { Authorization: this.authHeader(), "Content-Type": "application/json" },
    };
    if (body) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = json.error as { description?: string } | undefined;
      throw new Error(err?.description ?? `Razorpay error ${res.status}`);
    }
    return json;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const json = await this.razorpayFetch(`${RAZORPAY_API_BASE}/payment_links`, "POST", {
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      description: input.description.slice(0, 2048),
      reference_id: input.reference,
      callback_url: input.successUrl,
      callback_method: "get",
      notify: { sms: false, email: false },
    });
    const url = typeof json.short_url === "string" ? json.short_url : null;
    if (!url) throw new Error("Could not start checkout. Please try again.");
    return {
      mode: "redirect",
      url,
      externalPaymentId: typeof json.id === "string" ? json.id : null,
    };
  }

  async verifyWebhook(payload: string, signature: string | null): Promise<boolean> {
    if (!this.webhookSecret || !signature) return false;
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payload, "utf8")
      .digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  parseWebhookEvent(payload: string): PaymentWebhookEvent | null {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
    const eventName = typeof event.event === "string" ? event.event : "";
    const payloadObj = event.payload as Record<string, unknown> | undefined;
    const linkEntity = (
      (payloadObj?.payment_link as Record<string, unknown> | undefined)?.entity ?? {}
    ) as Record<string, unknown>;
    const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
    const reference = str(linkEntity.reference_id);
    const externalPaymentId = str(linkEntity.id);

    if (eventName === "payment_link.paid") {
      return { type: "paid", reference, externalPaymentId };
    }
    if (eventName === "payment_link.cancelled" || eventName === "payment_link.expired") {
      return { type: "failed", reference, externalPaymentId };
    }
    return { type: "ignored", reference, externalPaymentId };
  }

  // --- Payouts via Razorpay Route -------------------------------------------

  async createConnectedAccount(input: CreateConnectedAccountInput): Promise<ConnectedAccountResult> {
    // Create a Route linked account. Full KYC/activation is completed by the
    // seller in Razorpay; we only hold the opaque account id.
    const account = await this.razorpayFetch(`${RAZORPAY_API_BASE_V2}/accounts`, "POST", {
      type: "route",
      email: input.email ?? undefined,
      reference_id: input.organizationId,
      legal_business_name: `Taurus seller ${input.organizationId}`,
      business_type: "individual",
    });
    const id = typeof account.id === "string" ? account.id : null;
    if (!id) throw new Error("Could not create a payout account. Please try again.");
    return { externalAccountId: id, status: statusFromAccount(account) };
  }

  async createOnboardingLink(): Promise<OnboardingLinkResult> {
    // Razorpay Route activation is completed in the Razorpay dashboard rather
    // than a single hosted link.
    return { mode: "redirect", url: "https://dashboard.razorpay.com/app/route" };
  }

  async getAccountStatus(externalAccountId: string): Promise<PayoutAccountStatus> {
    const account = await this.razorpayFetch(
      `${RAZORPAY_API_BASE_V2}/accounts/${externalAccountId}`,
      "GET",
    );
    return statusFromAccount(account);
  }

  async createTransfer(input: CreateTransferInput): Promise<TransferResult> {
    const transfer = await this.razorpayFetch(`${RAZORPAY_API_BASE}/transfers`, "POST", {
      account: input.externalAccountId,
      amount: input.amount,
      currency: input.currency.toUpperCase(),
      notes: { reference: input.reference },
    });
    return {
      mode: "transferred",
      externalTransferId: typeof transfer.id === "string" ? transfer.id : null,
    };
  }

  parsePayoutWebhookEvent(payload: string): PayoutWebhookEvent | null {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
    const eventName = typeof event.event === "string" ? event.event : "";
    const payloadObj = event.payload as Record<string, unknown> | undefined;
    const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
    const entityOf = (key: string) =>
      ((payloadObj?.[key] as Record<string, unknown> | undefined)?.entity ?? {}) as Record<
        string,
        unknown
      >;

    if (eventName === "account.updated") {
      const acct = entityOf("account");
      return {
        type: "account.updated",
        externalAccountId: str(acct.id),
        accountStatus: statusFromAccount(acct),
        reference: null,
        externalTransferId: null,
      };
    }
    const transfer = entityOf("transfer");
    const reference = str((transfer.notes as Record<string, unknown> | undefined)?.reference);
    if (eventName === "transfer.processed") {
      return {
        type: "payout.paid",
        externalAccountId: str(transfer.recipient),
        accountStatus: null,
        reference,
        externalTransferId: str(transfer.id),
      };
    }
    if (eventName === "transfer.failed") {
      return {
        type: "payout.failed",
        externalAccountId: str(transfer.recipient),
        accountStatus: null,
        reference,
        externalTransferId: str(transfer.id),
      };
    }
    return { type: "ignored", externalAccountId: null, accountStatus: null, reference: null, externalTransferId: null };
  }
}

/** Derive our coarse status from a Razorpay Route account object. */
function statusFromAccount(account: Record<string, unknown>): PayoutAccountStatus {
  const status = typeof account.activation_status === "string" ? account.activation_status : "";
  const state = typeof account.status === "string" ? account.status : "";
  if (status === "activated" || state === "activated") return "active";
  if (status === "suspended" || state === "suspended") return "restricted";
  return "onboarding";
}

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
  CreateCheckoutInput,
  MarketplacePaymentProvider,
  PaymentWebhookEvent,
} from "@/modules/marketplace/payments/types";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

export class RazorpayPaymentProvider implements MarketplacePaymentProvider {
  readonly id = "razorpay" as const;

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string | null;

  constructor(config: { keyId: string; keySecret: string; webhookSecret?: string | null }) {
    this.keyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret ?? null;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    const res = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency.toUpperCase(),
        description: input.description.slice(0, 2048),
        reference_id: input.reference,
        callback_url: input.successUrl,
        callback_method: "get",
        notify: { sms: false, email: false },
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const err = json.error as { description?: string } | undefined;
      throw new Error(err?.description ?? `Razorpay error ${res.status}`);
    }
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
}

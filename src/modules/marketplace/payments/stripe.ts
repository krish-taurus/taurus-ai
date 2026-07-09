/**
 * Stripe marketplace payment provider (Sprint 034).
 *
 * A dependency-free adapter that talks to Stripe over HTTPS. Only constructed
 * when STRIPE_SECRET_KEY is set — providers/index.ts falls back to the simulated
 * provider otherwise, so this file is never reached in tests.
 *
 * Uses Stripe Checkout in `payment` mode (a one-time charge) with inline
 * price_data so sellers can name any amount/currency without pre-creating
 * Stripe Prices. Card data never touches Taurus. Webhook signatures are verified
 * with the configured signing secret using a constant-time HMAC comparison.
 */

import crypto from "node:crypto";
import type {
  CheckoutResult,
  CreateCheckoutInput,
  MarketplacePaymentProvider,
  PaymentWebhookEvent,
} from "@/modules/marketplace/payments/types";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export class StripeMarketplacePaymentProvider implements MarketplacePaymentProvider {
  readonly id = "stripe" as const;

  private readonly secretKey: string;
  private readonly webhookSecret: string | null;

  constructor(config: { secretKey: string; webhookSecret?: string | null }) {
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret ?? null;
  }

  private async stripeFetch(
    path: string,
    form: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const message =
        (json.error as { message?: string } | undefined)?.message ?? `Stripe error ${res.status}`;
      throw new Error(message);
    }
    return json;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const form: Record<string, string> = {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency,
      "line_items[0][price_data][unit_amount]": String(input.amount),
      "line_items[0][price_data][product_data][name]": input.description.slice(0, 250),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.reference,
      "metadata[reference]": input.reference,
      "payment_intent_data[metadata][reference]": input.reference,
    };
    const session = await this.stripeFetch("/checkout/sessions", form);
    const url = typeof session.url === "string" ? session.url : null;
    if (!url) throw new Error("Could not start checkout. Please try again.");
    return {
      mode: "redirect",
      url,
      externalPaymentId: typeof session.id === "string" ? session.id : null,
    };
  }

  async verifyWebhook(payload: string, signature: string | null): Promise<boolean> {
    if (!this.webhookSecret || !signature) return false;
    const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});
    const timestamp = parts.t;
    const provided = parts.v1;
    if (!timestamp || !provided) return false;
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${payload}`, "utf8")
      .digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
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
    const type = typeof event.type === "string" ? event.type : "";
    const object = ((event.data as Record<string, unknown> | undefined)?.object ?? {}) as Record<
      string,
      unknown
    >;
    const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
    const referenceFrom = (obj: Record<string, unknown>): string | null => {
      const meta = obj.metadata as Record<string, unknown> | undefined;
      return str(obj.client_reference_id) ?? str(meta?.reference);
    };

    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      // Only treat as paid when the session actually settled.
      const paid = str(object.payment_status) === "paid" || type.endsWith("succeeded");
      return {
        type: paid ? "paid" : "ignored",
        reference: referenceFrom(object),
        externalPaymentId: str(object.id),
      };
    }
    if (
      type === "checkout.session.expired" ||
      type === "checkout.session.async_payment_failed" ||
      type === "payment_intent.payment_failed"
    ) {
      return { type: "failed", reference: referenceFrom(object), externalPaymentId: str(object.id) };
    }
    return { type: "ignored", reference: referenceFrom(object), externalPaymentId: str(object.id) };
  }
}

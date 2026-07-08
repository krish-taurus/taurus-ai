/**
 * Stripe billing provider (Sprint 015).
 *
 * A real adapter that talks to Stripe over HTTPS (no SDK dependency). Only ever
 * constructed when STRIPE_SECRET_KEY is set — providers/index.ts falls back to
 * the simulated provider otherwise, so this file is never reached in tests.
 *
 * Card data never touches Taurus: checkout + portal are hosted by Stripe and we
 * only handle opaque ids. Webhook signatures are verified with the configured
 * signing secret using a constant-time HMAC comparison.
 */

import crypto from "node:crypto";
import type { PlanId } from "@/modules/billing/plans";
import { PLANS, PLANS_IN_ORDER, isPlanId } from "@/modules/billing/plans";
import type {
  BillingProvider,
  BillingWebhookEvent,
  BillingWebhookEventType,
  CheckoutSession,
  CreateCheckoutInput,
  CreatePortalInput,
  ExternalSubscriptionStatus,
  PortalSession,
} from "@/modules/billing/providers/types";
import type { BillingSubscriptionStatus } from "@/lib/db/types";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

/** Map Stripe's subscription statuses onto our smaller status set. */
function mapStripeStatus(status: string): BillingSubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // active, incomplete, paused, etc. → treat as active for entitlement purposes.
      return "active";
  }
}

function unixToIso(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

export class StripeBillingProvider implements BillingProvider {
  readonly mode = "stripe" as const;

  private readonly secretKey: string;
  private readonly webhookSecret: string | null;
  /** priceId → planId, resolved from STRIPE_PRICE_* env at construction. */
  private readonly priceToPlan: Map<string, PlanId>;
  private readonly planToPrice: Map<PlanId, string>;

  constructor(config: {
    secretKey: string;
    webhookSecret?: string | null;
    priceIds?: Partial<Record<PlanId, string | undefined>>;
  }) {
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret ?? null;
    this.priceToPlan = new Map();
    this.planToPrice = new Map();
    for (const plan of PLANS_IN_ORDER) {
      if (!plan.stripePriceEnvVar) continue;
      const priceId = config.priceIds?.[plan.id] ?? process.env[plan.stripePriceEnvVar] ?? null;
      if (priceId) {
        this.priceToPlan.set(priceId, plan.id);
        this.planToPrice.set(plan.id, priceId);
      }
    }
  }

  private async stripeFetch(
    path: string,
    method: "GET" | "POST",
    form?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };
    if (form) init.body = new URLSearchParams(form).toString();
    const res = await fetch(`${STRIPE_API_BASE}${path}`, init);
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const message =
        (json.error as { message?: string } | undefined)?.message ?? `Stripe error ${res.status}`;
      throw new Error(message);
    }
    return json;
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const priceId = this.planToPrice.get(input.planId);
    if (!priceId) {
      throw new Error("This plan is not available for checkout right now.");
    }
    const form: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.organizationId,
      "metadata[organizationId]": input.organizationId,
      "subscription_data[metadata][organizationId]": input.organizationId,
    };
    if (input.externalCustomerId) form.customer = input.externalCustomerId;
    const session = await this.stripeFetch("/checkout/sessions", "POST", form);
    const url = typeof session.url === "string" ? session.url : null;
    if (!url) throw new Error("Could not start checkout. Please try again.");
    return { mode: "redirect", url };
  }

  async createBillingPortalSession(input: CreatePortalInput): Promise<PortalSession> {
    if (!input.externalCustomerId) {
      throw new Error("There is no billing account to manage yet.");
    }
    const session = await this.stripeFetch("/billing_portal/sessions", "POST", {
      customer: input.externalCustomerId,
      return_url: input.returnUrl,
    });
    const url = typeof session.url === "string" ? session.url : null;
    if (!url) throw new Error("Could not open the billing portal. Please try again.");
    return { mode: "redirect", url };
  }

  async verifyWebhook(payload: string, signature: string | null): Promise<boolean> {
    // When no signing secret is configured we cannot verify — reject to stay safe.
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

  parseWebhookEvent(payload: string): BillingWebhookEvent | null {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
    const stripeType = typeof event.type === "string" ? event.type : "";
    const object = ((event.data as Record<string, unknown> | undefined)?.object ?? {}) as Record<
      string,
      unknown
    >;
    const externalEventId = typeof event.id === "string" ? event.id : null;

    const base = {
      externalEventId,
      externalCustomerId: null as string | null,
      externalSubscriptionId: null as string | null,
      planId: null as PlanId | null,
      status: null as BillingSubscriptionStatus | null,
      cancelAtPeriodEnd: null as boolean | null,
      currentPeriodStart: null as string | null,
      currentPeriodEnd: null as string | null,
    };

    const stringField = (value: unknown): string | null =>
      typeof value === "string" ? value : null;

    const planFromItems = (obj: Record<string, unknown>): PlanId | null => {
      const items = (obj.items as { data?: Array<Record<string, unknown>> } | undefined)?.data;
      const priceId = items?.[0]?.price
        ? stringField((items[0].price as Record<string, unknown>).id)
        : null;
      if (priceId && this.priceToPlan.has(priceId)) return this.priceToPlan.get(priceId)!;
      const metaPlan = (obj.metadata as Record<string, unknown> | undefined)?.planId;
      return isPlanId(metaPlan) ? (metaPlan as PlanId) : null;
    };

    let type: BillingWebhookEventType = "ignored";
    if (stripeType === "checkout.session.completed") {
      type = "checkout.completed";
      base.externalCustomerId = stringField(object.customer);
      base.externalSubscriptionId = stringField(object.subscription);
      const metaPlan = (object.metadata as Record<string, unknown> | undefined)?.planId;
      base.planId = isPlanId(metaPlan) ? (metaPlan as PlanId) : null;
      base.status = "active";
    } else if (
      stripeType === "customer.subscription.updated" ||
      stripeType === "customer.subscription.deleted"
    ) {
      type =
        stripeType === "customer.subscription.deleted"
          ? "subscription.deleted"
          : "subscription.updated";
      base.externalCustomerId = stringField(object.customer);
      base.externalSubscriptionId = stringField(object.id);
      base.planId = planFromItems(object);
      base.status =
        type === "subscription.deleted"
          ? "canceled"
          : mapStripeStatus(stringField(object.status) ?? "active");
      base.cancelAtPeriodEnd =
        typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : null;
      base.currentPeriodStart = unixToIso(object.current_period_start);
      base.currentPeriodEnd = unixToIso(object.current_period_end);
    } else if (stripeType === "invoice.payment_failed") {
      type = "payment.failed";
      base.externalCustomerId = stringField(object.customer);
      base.externalSubscriptionId = stringField(object.subscription);
      base.status = "past_due";
    }

    return { type, ...base };
  }

  async getSubscriptionStatus(
    externalSubscriptionId: string,
  ): Promise<ExternalSubscriptionStatus | null> {
    const sub = await this.stripeFetch(`/subscriptions/${externalSubscriptionId}`, "GET");
    const items = (sub.items as { data?: Array<Record<string, unknown>> } | undefined)?.data;
    const priceId =
      items?.[0]?.price && typeof (items[0].price as Record<string, unknown>).id === "string"
        ? ((items[0].price as Record<string, unknown>).id as string)
        : null;
    const planId = priceId && this.priceToPlan.has(priceId) ? this.priceToPlan.get(priceId)! : null;
    return {
      externalSubscriptionId,
      planId,
      status: mapStripeStatus(typeof sub.status === "string" ? sub.status : "active"),
      cancelAtPeriodEnd:
        typeof sub.cancel_at_period_end === "boolean" ? sub.cancel_at_period_end : false,
      currentPeriodStart: unixToIso(sub.current_period_start),
      currentPeriodEnd: unixToIso(sub.current_period_end),
    };
  }
}

/** Re-export used by the plans map, kept here to avoid an unused import warning. */
export const STRIPE_PLAN_PRICE_ENV: Record<PlanId, string | null> = {
  starter: PLANS.starter.stripePriceEnvVar,
  growth: PLANS.growth.stripePriceEnvVar,
  scale: PLANS.scale.stripePriceEnvVar,
};

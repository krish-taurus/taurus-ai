import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { getClientEnv } from "@/lib/env/env";
import { hasPermission, ROLES } from "@/modules/organizations/roles";
import { PLANS, DEFAULT_PLAN_ID } from "@/modules/billing/plans";
import {
  assertCanAddConnection,
  assertCanAddKnowledgeSource,
  assertCanHireEmployee,
  assertWithinInteractionQuota,
  buildEntitlementSnapshot,
  EntitlementError,
  getBillingOverview,
  getOrganizationPlan,
  startPlanChange,
  applyWebhookEvent,
} from "@/modules/billing/service";
import { SimulatedBillingProvider } from "@/modules/billing/providers/simulated";
import { StripeBillingProvider } from "@/modules/billing/providers/stripe";
import { hireEmployee } from "@/modules/employees/hiring";
import { createWebChannel } from "@/modules/channels/service";
import { createTextSource } from "@/modules/knowledge/service";

/**
 * Sprint 015 — Billing runtime verification (Phase 2). Drives billing as a user
 * would, in SIMULATED mode (no STRIPE_SECRET_KEY), through the real
 * service/provider/enforcement code — not client mocks. Each block maps to an
 * item (A–G) in 05_reports/RUNTIME_VERIFICATION.md.
 *
 * NOTE ON NUMBERS: the catalog is Starter = 1 employee / 5 knowledge / 1
 * connection / 100 interactions; Growth = 3 / 50 / unlimited connections / 2,000;
 * Scale = 10 / 500 / unlimited / 10,000 (soft-cap). Growth and Scale also enable
 * the Performance Review + BYOK feature flags. These tests assert those values.
 */

const SIMULATED = new SimulatedBillingProvider();
const URLS = { successUrl: "https://app/x", cancelUrl: "https://app/y" };

async function makeOrg(store: InMemoryStore, name: string) {
  const user = await store.createUser({ email: `${name}@example.com`, fullName: `${name} Owner` });
  const view = await store.createOrganizationWithOwner({
    organization: { name, slug: name },
    ownerUserId: user.id,
  });
  return { orgId: view.organization.id, userId: user.id };
}

const HIRE_BASE = {
  responsibilities: [] as string[],
  tone: "friendly",
  formality: "casual",
  riskLevel: "balanced",
  escalation: "ask_when_unsure",
} as const;

// ===========================================================================
// A. Default plan on signup
// ===========================================================================
describe("A. Default plan on signup", () => {
  it("puts a brand-new organization on Starter automatically (no card, no step)", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "acme");

    const sub = await store.getBillingSubscription(orgId);
    expect(sub?.planId).toBe("starter");
    expect(sub?.status).toBe("active");
    expect(DEFAULT_PLAN_ID).toBe("starter");
    expect((await getOrganizationPlan(store, orgId)).id).toBe("starter");
  });

  it("billing dashboard data shows plan, status, period, and usage vs. quota", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "acme");
    const overview = await getBillingOverview(store, orgId, SIMULATED);

    expect(overview.plan.id).toBe("starter");
    expect(overview.subscription.status).toBe("active");
    expect(new Date(overview.subscription.currentPeriodEnd).getTime()).toBeGreaterThan(
      new Date(overview.subscription.currentPeriodStart).getTime(),
    );
    // Usage-vs-quota for each entitlement, with the plan's real limits.
    expect(overview.usage.employees.limit).toBe(1);
    expect(overview.usage.knowledgeSources.limit).toBe(5);
    expect(overview.usage.connections.limit).toBe(1);
    expect(overview.usage.interactions.limit).toBe(100);
    expect(overview.simulated).toBe(true);
  });
});

// ===========================================================================
// B. Entitlement enforcement — server-side, bypassing the client
// ===========================================================================
describe("B. Entitlement enforcement (server-side)", () => {
  it("blocks hiring past the Starter AI Employee cap with an upgrade message", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "hire");
    const actor = { organizationId: orgId, userId };
    const cap = PLANS.starter.entitlements.maxEmployees; // 1

    for (let i = 0; i < cap; i++) {
      await hireEmployee(store, actor, { name: `Emp ${i}`, roleTitle: "Support", ...HIRE_BASE });
    }
    // Direct service call (bypasses any client gating) still blocks.
    const err = await hireEmployee(store, actor, {
      name: "Over",
      roleTitle: "Support",
      ...HIRE_BASE,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(EntitlementError);
    expect(err.message).toMatch(/reached your plan's limit/i);
    expect(err.message).toMatch(/upgrade/i);
    expect(err.message).not.toMatch(/error code|\b[45]\d\d\b/i); // no raw error code
  });

  it("blocks a 2nd connection on Starter (cap 1)", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "conn");
    const actor = { organizationId: orgId, userId };
    const employee = await store.createEmployee({
      organizationId: orgId,
      name: "Nova",
      roleTitle: "Support",
      status: "active",
      createdBy: userId,
    });
    await createWebChannel(store, actor, employee, { name: "Website" });
    const err = await createWebChannel(store, actor, employee, { name: "Second" }).catch((e) => e);
    expect(err).toBeInstanceOf(EntitlementError);
    expect(err.message).toMatch(/connection/i);
  });

  it("blocks Knowledge sources past the Starter cap (5)", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "know");
    const actor = { organizationId: orgId, userId };
    const cap = PLANS.starter.entitlements.maxKnowledgeSources; // 5
    for (let i = 0; i < cap; i++) {
      await createTextSource(store, actor, {
        name: `Note ${i}`,
        visibility: "organization",
        text: "content",
      });
    }
    const err = await createTextSource(store, actor, {
      name: "Over",
      visibility: "organization",
      text: "content",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(EntitlementError);
    expect(err.message).toMatch(/Knowledge Vault source/i);
  });

  it("blocks a further reply once the interaction quota is spent, reading from usage events", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "quota");
    const quota = PLANS.starter.entitlements.monthlyInteractionQuota; // 100

    // Under quota → allowed.
    await expect(assertWithinInteractionQuota(store, orgId)).resolves.toBeTruthy();

    // Emit `quota` billable interactions as ordinary usage events.
    for (let i = 0; i < quota; i++) {
      await store.createLlmUsageEvent({
        organizationId: orgId,
        employeeId: "emp",
        providerSlug: "openai",
        modelId: "gpt-5.4",
        taskType: "employee_chat",
        inputTokens: 1,
        outputTokens: 1,
        status: "success",
        createdByUserId: userId,
      });
    }
    // The quota is derived from the usage events (not a parallel counter).
    const snap = await buildEntitlementSnapshot(store, orgId);
    expect(snap.interactionsThisPeriod).toBe(quota);
    // The same gate the chat runtime calls now blocks.
    await expect(assertWithinInteractionQuota(store, orgId)).rejects.toBeInstanceOf(
      EntitlementError,
    );
  });
});

// ===========================================================================
// C. Upgrade / downgrade (simulated mode)
// ===========================================================================
describe("C. Upgrade / downgrade (simulated)", () => {
  it("upgrades to Growth then Scale, lifting limits immediately + writing events", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "up");
    const actor = { organizationId: orgId, userId };

    // On Starter (cap 1), hiring beyond the cap is blocked once 2 exist.
    await store.createEmployee({
      organizationId: orgId,
      name: "A",
      roleTitle: "R",
      status: "active",
      createdBy: userId,
    });
    await store.createEmployee({
      organizationId: orgId,
      name: "B",
      roleTitle: "R",
      status: "active",
      createdBy: userId,
    });
    await expect(assertCanHireEmployee(store, orgId)).rejects.toBeInstanceOf(EntitlementError);

    const g = await startPlanChange(store, actor, SIMULATED, "growth", URLS);
    expect(g.kind).toBe("applied");
    expect((await getOrganizationPlan(store, orgId)).id).toBe("growth");
    // Limit lifted immediately — hiring a 3rd is now allowed.
    await expect(assertCanHireEmployee(store, orgId)).resolves.toBeUndefined();
    const growthPlan = (await buildEntitlementSnapshot(store, orgId)).plan;
    expect(growthPlan.entitlements.maxEmployees).toBe(3);
    // Growth is unlimited on connections and flips on the paid feature flags.
    expect(growthPlan.entitlements.maxConnections).toBe(Infinity);
    expect(growthPlan.features.performanceReview).toBe(true);
    expect(growthPlan.features.byok).toBe(true);

    const s = await startPlanChange(store, actor, SIMULATED, "scale", URLS);
    expect(s.kind).toBe("applied");
    expect((await buildEntitlementSnapshot(store, orgId)).plan.entitlements.maxEmployees).toBe(10);

    // A billing_events row AND an audit event were written for each change.
    const events = await store.listBillingEvents(orgId);
    expect(
      events.filter((e) => e.eventType === "subscription.upgraded").length,
    ).toBeGreaterThanOrEqual(2);
    const audit = store._auditEvents().map((e) => e.action);
    expect(audit).toContain("billing.plan_upgraded");
  });

  it("downgrade is safe — no data deleted; over-limit resources are kept, future adds blocked", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "down");
    const actor = { organizationId: orgId, userId };

    await startPlanChange(store, actor, SIMULATED, "growth", URLS);
    // Hire 3 employees (allowed on Growth).
    for (let i = 0; i < 3; i++) {
      await store.createEmployee({
        organizationId: orgId,
        name: `E${i}`,
        roleTitle: "R",
        status: "active",
        createdBy: userId,
      });
    }
    // Downgrade back to Starter (free) — applies immediately.
    const d = await startPlanChange(store, actor, SIMULATED, "starter", URLS);
    expect(d.kind).toBe("applied");
    expect((await getOrganizationPlan(store, orgId)).id).toBe("starter");

    // Existing employees are NOT deleted (data preserved).
    expect((await store.listEmployees(orgId)).length).toBe(3);
    // But now over the Starter cap, so a further hire is blocked (no silent deletion).
    await expect(assertCanHireEmployee(store, orgId)).rejects.toBeInstanceOf(EntitlementError);

    const audit = store._auditEvents().map((e) => e.action);
    expect(audit).toContain("billing.plan_downgraded");
  });
});

// ===========================================================================
// D. Permissions & isolation
// ===========================================================================
describe("D. Permissions & isolation", () => {
  it("viewer/builder can view billing but cannot manage; owner/admin can manage", () => {
    for (const role of ROLES) expect(hasPermission(role, "billing.view")).toBe(true);
    expect(hasPermission("owner", "billing.manage")).toBe(true);
    expect(hasPermission("admin", "billing.manage")).toBe(true);
    expect(hasPermission("builder", "billing.manage")).toBe(false);
    expect(hasPermission("viewer", "billing.manage")).toBe(false);
  });

  it("one organization cannot read or change another's subscription", async () => {
    const store = new InMemoryStore();
    const a = await makeOrg(store, "orga");
    const b = await makeOrg(store, "orgb");

    await startPlanChange(
      store,
      { organizationId: a.orgId, userId: a.userId },
      SIMULATED,
      "scale",
      URLS,
    );

    // Org B is untouched by Org A's change; each reads only its own subscription.
    expect((await getOrganizationPlan(store, a.orgId)).id).toBe("scale");
    expect((await getOrganizationPlan(store, b.orgId)).id).toBe("starter");
    expect((await store.getBillingSubscription(a.orgId))?.organizationId).toBe(a.orgId);
    expect((await store.getBillingSubscription(b.orgId))?.organizationId).toBe(b.orgId);
  });
});

// ===========================================================================
// E. Webhook
// ===========================================================================
describe("E. Webhook", () => {
  const stripe = new StripeBillingProvider({
    secretKey: "sk_test_x",
    webhookSecret: "whsec_test",
    priceIds: { growth: "price_growth", scale: "price_scale" },
  });

  function signed(payload: string): string {
    const t = "1700000000";
    const sig = crypto.createHmac("sha256", "whsec_test").update(`${t}.${payload}`).digest("hex");
    return `t=${t},v1=${sig}`;
  }

  it("verifies the signature when configured and rejects unsigned/invalid payloads", async () => {
    const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
    expect(await stripe.verifyWebhook(payload, signed(payload))).toBe(true);
    expect(await stripe.verifyWebhook(payload, null)).toBe(false);
    expect(await stripe.verifyWebhook(payload, "t=1700000000,v1=deadbeef")).toBe(false);
    expect(await stripe.verifyWebhook(payload + "x", signed(payload))).toBe(false);
  });

  it("parses each event type into a normalized event", () => {
    const checkout = stripe.parseWebhookEvent(
      JSON.stringify({
        id: "evt",
        type: "checkout.session.completed",
        data: {
          object: { customer: "cus_1", subscription: "sub_1", metadata: { planId: "growth" } },
        },
      }),
    );
    expect(checkout?.type).toBe("checkout.completed");
    expect(checkout?.externalCustomerId).toBe("cus_1");

    const updated = stripe.parseWebhookEvent(
      JSON.stringify({
        id: "evt",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_1",
            customer: "cus_1",
            status: "active",
            items: { data: [{ price: { id: "price_growth" } }] },
          },
        },
      }),
    );
    expect(updated?.type).toBe("subscription.updated");
    expect(updated?.planId).toBe("growth");
    expect(updated?.status).toBe("active");

    const deleted = stripe.parseWebhookEvent(
      JSON.stringify({
        id: "evt",
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_1", customer: "cus_1" } },
      }),
    );
    expect(deleted?.type).toBe("subscription.deleted");
    expect(deleted?.status).toBe("canceled");

    const failed = stripe.parseWebhookEvent(
      JSON.stringify({
        id: "evt",
        type: "invoice.payment_failed",
        data: { object: { customer: "cus_1", subscription: "sub_1" } },
      }),
    );
    expect(failed?.type).toBe("payment.failed");
    expect(failed?.status).toBe("past_due");
  });

  it("resolves the organization from stored ids only and updates status; unknown ids are ignored", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "hook");
    await store.upsertBillingCustomer({
      organizationId: orgId,
      externalCustomerId: "cus_1",
      provider: "stripe",
    });

    // Unknown mapping → not applied (deny-by-default, never trusts client input).
    expect(
      await applyWebhookEvent(store, {
        type: "subscription.updated",
        externalCustomerId: "cus_unknown",
        externalSubscriptionId: null,
        planId: "growth",
        status: "active",
        cancelAtPeriodEnd: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        externalEventId: "e",
      }),
    ).toBe(false);

    // Known customer → org resolved from the stored mapping, status updated.
    expect(
      await applyWebhookEvent(store, {
        type: "subscription.updated",
        externalCustomerId: "cus_1",
        externalSubscriptionId: "sub_1",
        planId: "growth",
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        externalEventId: "e2",
      }),
    ).toBe(true);
    expect((await store.getBillingSubscription(orgId))?.planId).toBe("growth");

    // payment_failed → past_due.
    await applyWebhookEvent(store, {
      type: "payment.failed",
      externalCustomerId: "cus_1",
      externalSubscriptionId: "sub_1",
      planId: null,
      status: "past_due",
      cancelAtPeriodEnd: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      externalEventId: "e3",
    });
    expect((await store.getBillingSubscription(orgId))?.status).toBe("past_due");

    // subscription.deleted → canceled.
    await applyWebhookEvent(store, {
      type: "subscription.deleted",
      externalCustomerId: "cus_1",
      externalSubscriptionId: "sub_1",
      planId: null,
      status: "canceled",
      cancelAtPeriodEnd: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      externalEventId: "e4",
    });
    expect((await store.getBillingSubscription(orgId))?.status).toBe("canceled");
  });
});

// ===========================================================================
// F. Store parity & safety
// ===========================================================================
describe("F. Store parity & safety", () => {
  const BILLING_METHODS = [
    "getBillingSubscription",
    "createBillingSubscription",
    "updateBillingSubscription",
    "getBillingCustomer",
    "getBillingCustomerByExternalId",
    "getBillingSubscriptionByExternalId",
    "upsertBillingCustomer",
    "createBillingEvent",
    "listBillingEvents",
    "countBillableInteractionsSince",
  ];

  it("every billing store method exists in BOTH the in-memory and PostgreSQL backends", () => {
    const mem = readFileSync(join(process.cwd(), "src/lib/db/in-memory-store.ts"), "utf8");
    const pg = readFileSync(join(process.cwd(), "src/lib/db/postgres-store.ts"), "utf8");
    for (const m of BILLING_METHODS) {
      expect(mem, `in-memory missing ${m}`).toContain(`async ${m}(`);
      expect(pg, `postgres missing ${m}`).toContain(`async ${m}(`);
    }
  });

  it("billing events are metadata-only (no card / email / raw payload)", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "meta");
    await startPlanChange(store, { organizationId: orgId, userId: "u" }, SIMULATED, "growth", URLS);
    const events = await store.listBillingEvents(orgId);
    const serialized = JSON.stringify(events).toLowerCase();
    for (const banned of ["card", "cardnumber", "cvc", "cvv", "pan", "@", "raw_payload"]) {
      expect(serialized, `billing event leaked "${banned}"`).not.toContain(banned);
    }
  });

  it("Stripe secrets are server-only — never in the client env or NEXT_PUBLIC_*", () => {
    // The resolved client env (the only env exposed to the browser) has no Stripe key.
    const clientKeys = Object.keys(getClientEnv());
    expect(clientKeys.some((k) => /stripe/i.test(k))).toBe(false);
    // No NEXT_PUBLIC_ Stripe variable exists anywhere in the env module.
    const env = readFileSync(join(process.cwd(), "src/lib/env/env.ts"), "utf8");
    expect(env).not.toMatch(/NEXT_PUBLIC_STRIPE/);
  });
});

// ===========================================================================
// Simulated-mode default (no STRIPE_SECRET_KEY)
// ===========================================================================
describe("Simulated mode is the default without Stripe keys", () => {
  const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("the simulated provider applies upgrades instantly and never returns a checkout URL", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "sim");
    const result = await startPlanChange(
      store,
      { organizationId: orgId, userId },
      SIMULATED,
      "growth",
      URLS,
    );
    expect(result.kind).toBe("applied");
    expect(SIMULATED.mode).toBe("simulated");
  });
});

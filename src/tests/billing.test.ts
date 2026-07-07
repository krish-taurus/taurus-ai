import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { hasPermission, ROLES } from "@/modules/organizations/roles";
import {
  PLANS,
  PLANS_IN_ORDER,
  PLAN_IDS,
  DEFAULT_PLAN_ID,
  getPlan,
  isPlanId,
} from "@/modules/billing/plans";
import {
  canAddConnection,
  canAddKnowledgeSource,
  canHireEmployee,
  planIncludesFeature,
  withinInteractionQuota,
  type EntitlementSnapshot,
} from "@/modules/billing/entitlements";
import {
  assertWithinInteractionQuota,
  buildEntitlementSnapshot,
  EntitlementError,
  ensureSubscription,
  getBillingOverview,
  getOrganizationPlan,
  startPlanChange,
  applyWebhookEvent,
} from "@/modules/billing/service";
import { SimulatedBillingProvider } from "@/modules/billing/providers/simulated";
import type { BillingWebhookEvent } from "@/modules/billing/providers/types";
import { hireEmployee } from "@/modules/employees/hiring";
import type { PlanId } from "@/modules/billing/plans";

const SIMULATED = new SimulatedBillingProvider();

/** Build an entitlement snapshot for a plan with explicit usage counts. */
function snapshot(planId: PlanId, counts: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    plan: PLANS[planId],
    activeEmployees: 0,
    knowledgeSources: 0,
    connections: 0,
    interactionsThisPeriod: 0,
    ...counts,
  };
}

/** Create an organization through the normal flow (which seeds Starter). */
async function makeOrg(store: InMemoryStore, name: string): Promise<string> {
  const user = await store.createUser({ email: `${name}@example.com` });
  const view = await store.createOrganizationWithOwner({
    organization: { name, slug: name },
    ownerUserId: user.id,
  });
  return view.organization.id;
}

// ---------------------------------------------------------------------------

describe("Plans catalog integrity", () => {
  it("defines exactly Starter, Growth, and Scale", () => {
    expect(PLAN_IDS).toEqual(["starter", "growth", "scale"]);
    expect(PLANS_IN_ORDER.map((p) => p.id)).toEqual(["starter", "growth", "scale"]);
    expect(DEFAULT_PLAN_ID).toBe("starter");
  });

  it("has fully-typed prices and entitlements for every plan", () => {
    for (const plan of PLANS_IN_ORDER) {
      expect(typeof plan.monthlyPriceUsd).toBe("number");
      expect(plan.monthlyPriceUsd).toBeGreaterThanOrEqual(0);
      const ent = plan.entitlements;
      for (const value of [
        ent.maxEmployees,
        ent.maxKnowledgeSources,
        ent.maxConnections,
        ent.monthlyInteractionQuota,
      ]) {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThan(0);
      }
      expect(["block", "soft_cap"]).toContain(plan.overageBehavior);
      expect(plan.highlights.length).toBeGreaterThan(0);
    }
  });

  it("prices Starter as free and paid tiers as increasing", () => {
    expect(PLANS.starter.isFree).toBe(true);
    expect(PLANS.starter.monthlyPriceUsd).toBe(0);
    expect(PLANS.growth.monthlyPriceUsd).toBeGreaterThan(PLANS.starter.monthlyPriceUsd);
    expect(PLANS.scale.monthlyPriceUsd).toBeGreaterThan(PLANS.growth.monthlyPriceUsd);
  });

  it("entitlements grow with tier", () => {
    expect(PLANS.growth.entitlements.maxEmployees).toBeGreaterThan(
      PLANS.starter.entitlements.maxEmployees,
    );
    expect(PLANS.scale.entitlements.maxEmployees).toBeGreaterThan(
      PLANS.growth.entitlements.maxEmployees,
    );
    expect(PLANS.scale.entitlements.monthlyInteractionQuota).toBeGreaterThan(
      PLANS.growth.entitlements.monthlyInteractionQuota,
    );
  });

  it("only paid tiers carry a Stripe price env var", () => {
    expect(PLANS.starter.stripePriceEnvVar).toBeNull();
    expect(PLANS.growth.stripePriceEnvVar).toBe("STRIPE_PRICE_GROWTH");
    expect(PLANS.scale.stripePriceEnvVar).toBe("STRIPE_PRICE_SCALE");
  });

  it("resolves unknown plan ids to Starter (deny-by-default)", () => {
    expect(getPlan("nonsense").id).toBe("starter");
    expect(getPlan(null).id).toBe("starter");
    expect(getPlan("growth").id).toBe("growth");
    expect(isPlanId("scale")).toBe(true);
    expect(isPlanId("enterprise")).toBe(false);
  });

  it("gates Performance Review + BYOK to the paid tiers", () => {
    expect(PLANS.starter.features.performanceReview).toBe(false);
    expect(PLANS.starter.features.byok).toBe(false);
    for (const id of ["growth", "scale"] as const) {
      expect(PLANS[id].features.performanceReview).toBe(true);
      expect(PLANS[id].features.byok).toBe(true);
    }
    // The pure gate helper deny-by-defaults for Starter and allows paid tiers.
    expect(planIncludesFeature(PLANS.starter, "byok")).toBe(false);
    expect(planIncludesFeature(PLANS.growth, "byok")).toBe(true);
    expect(planIncludesFeature(PLANS.scale, "performanceReview")).toBe(true);
  });

  it("gives the paid tiers unlimited connections that never block", () => {
    expect(PLANS.growth.entitlements.maxConnections).toBe(Infinity);
    expect(PLANS.scale.entitlements.maxConnections).toBe(Infinity);
    // Even at a very high count, an unlimited plan still allows another connection.
    expect(canAddConnection(snapshot("growth", { connections: 10_000 })).allowed).toBe(true);
    expect(canAddConnection(snapshot("scale", { connections: 10_000 })).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("Entitlement math (pure)", () => {
  it("employees: allows below limit, blocks at/over limit (Starter)", () => {
    const limit = PLANS.starter.entitlements.maxEmployees;
    expect(canHireEmployee(snapshot("starter", { activeEmployees: limit - 1 })).allowed).toBe(true);
    const atLimit = canHireEmployee(snapshot("starter", { activeEmployees: limit }));
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.reason).toMatch(/AI Employee/);
    expect(canHireEmployee(snapshot("starter", { activeEmployees: limit + 5 })).allowed).toBe(
      false,
    );
  });

  it("employees: a higher plan unlocks more headroom", () => {
    const starterCap = PLANS.starter.entitlements.maxEmployees;
    // At the Starter cap, Growth still allows hiring.
    expect(canHireEmployee(snapshot("growth", { activeEmployees: starterCap })).allowed).toBe(true);
    expect(canHireEmployee(snapshot("scale", { activeEmployees: starterCap })).allowed).toBe(true);
  });

  it("knowledge sources: at-limit and over-limit block", () => {
    const limit = PLANS.growth.entitlements.maxKnowledgeSources;
    expect(canAddKnowledgeSource(snapshot("growth", { knowledgeSources: limit - 1 })).allowed).toBe(
      true,
    );
    expect(canAddKnowledgeSource(snapshot("growth", { knowledgeSources: limit })).allowed).toBe(
      false,
    );
  });

  it("connections: at-limit and over-limit block", () => {
    const limit = PLANS.starter.entitlements.maxConnections;
    expect(canAddConnection(snapshot("starter", { connections: limit - 1 })).allowed).toBe(true);
    expect(canAddConnection(snapshot("starter", { connections: limit })).allowed).toBe(false);
    // Scale allows many more.
    expect(canAddConnection(snapshot("scale", { connections: limit })).allowed).toBe(true);
  });

  it("interaction quota: a block-plan refuses at/over quota", () => {
    const limit = PLANS.starter.entitlements.monthlyInteractionQuota;
    expect(
      withinInteractionQuota(snapshot("starter", { interactionsThisPeriod: limit - 1 })).allowed,
    ).toBe(true);
    const over = withinInteractionQuota(snapshot("starter", { interactionsThisPeriod: limit }));
    expect(over.allowed).toBe(false);
    expect(over.softCapped).toBeFalsy();
  });

  it("interaction quota: a soft-cap plan keeps working with a notice", () => {
    const limit = PLANS.scale.entitlements.monthlyInteractionQuota;
    const over = withinInteractionQuota(snapshot("scale", { interactionsThisPeriod: limit + 10 }));
    expect(over.allowed).toBe(true);
    expect(over.softCapped).toBe(true);
    expect(over.reason).toMatch(/interactions/);
  });
});

// ---------------------------------------------------------------------------

describe("Implicit Starter subscription", () => {
  it("puts a new organization on Starter automatically", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "acme");
    const sub = await store.getBillingSubscription(orgId);
    expect(sub).not.toBeNull();
    expect(sub!.planId).toBe("starter");
    expect(sub!.status).toBe("active");
    expect((await getOrganizationPlan(store, orgId)).id).toBe("starter");
  });

  it("ensureSubscription backfills a Starter subscription for a bare org", async () => {
    const store = new InMemoryStore();
    // org-x was never created through the normal flow → no subscription yet.
    expect(await store.getBillingSubscription("org-x")).toBeNull();
    const sub = await ensureSubscription(store, "org-x");
    expect(sub.planId).toBe("starter");
  });
});

// ---------------------------------------------------------------------------

describe("Simulated upgrade path", () => {
  it("moves the org to Growth immediately and emits a billing event", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "growco");

    const result = await startPlanChange(
      store,
      { organizationId: orgId, userId: "u1" },
      SIMULATED,
      "growth",
      { successUrl: "https://app/x", cancelUrl: "https://app/y" },
    );

    expect(result.kind).toBe("applied");
    expect((await getOrganizationPlan(store, orgId)).id).toBe("growth");

    const events = await store.listBillingEvents(orgId);
    expect(
      events.some((e) => e.eventType === "subscription.upgraded" && e.planId === "growth"),
    ).toBe(true);
  });

  it("unlocks higher entitlements right after a simulated upgrade to Scale", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "scaleco");

    // On Starter, hiring past 2 employees is blocked.
    const before = await buildEntitlementSnapshot(store, orgId);
    expect(before.plan.entitlements.maxEmployees).toBe(PLANS.starter.entitlements.maxEmployees);

    await startPlanChange(store, { organizationId: orgId, userId: "u1" }, SIMULATED, "scale", {
      successUrl: "https://app/x",
      cancelUrl: "https://app/y",
    });

    const after = await buildEntitlementSnapshot(store, orgId);
    expect(after.plan.entitlements.maxEmployees).toBe(PLANS.scale.entitlements.maxEmployees);
  });

  it("reports simulated mode in the overview", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "simco");
    const overview = await getBillingOverview(store, orgId, SIMULATED);
    expect(overview.simulated).toBe(true);
    expect(overview.plan.id).toBe("starter");
    expect(overview.usage.interactions.limit).toBe(
      PLANS.starter.entitlements.monthlyInteractionQuota,
    );
  });
});

// ---------------------------------------------------------------------------

describe("Server-side enforcement", () => {
  it("blocks hiring past the Starter employee cap with an upgrade message", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "hireco");
    const actor = { organizationId: orgId, userId: "u1" };
    const base = {
      responsibilities: [] as string[],
      tone: "friendly",
      formality: "casual",
      riskLevel: "balanced",
      escalation: "ask_when_unsure",
    } as const;

    const cap = PLANS.starter.entitlements.maxEmployees;
    for (let i = 0; i < cap; i++) {
      await hireEmployee(store, actor, { name: `Emp ${i}`, roleTitle: "Support", ...base });
    }

    await expect(
      hireEmployee(store, actor, { name: "One too many", roleTitle: "Support", ...base }),
    ).rejects.toThrow(EntitlementError);
    await expect(
      hireEmployee(store, actor, { name: "One too many", roleTitle: "Support", ...base }),
    ).rejects.toThrow(/reached your plan's limit/);
  });

  it("blocks the chat runtime once the interaction quota is spent", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "quotaco");
    const quota = PLANS.starter.entitlements.monthlyInteractionQuota;

    // Under quota: allowed.
    await expect(assertWithinInteractionQuota(store, orgId)).resolves.toBeTruthy();

    // Emit exactly `quota` billable interactions this period.
    for (let i = 0; i < quota; i++) {
      await store.createLlmUsageEvent({
        organizationId: orgId,
        providerSlug: "openai",
        modelId: "gpt-5.4",
        taskType: "employee_chat",
        inputTokens: 1,
        outputTokens: 1,
        status: "success",
      });
    }

    await expect(assertWithinInteractionQuota(store, orgId)).rejects.toThrow(EntitlementError);
  });

  it("does not count non-billable task types toward the quota", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "noncount");
    for (let i = 0; i < 5; i++) {
      await store.createLlmUsageEvent({
        organizationId: orgId,
        providerSlug: "openai",
        modelId: "gpt-5.4",
        taskType: "knowledge_summary",
        inputTokens: 1,
        outputTokens: 1,
        status: "success",
      });
    }
    const snap = await buildEntitlementSnapshot(store, orgId);
    expect(snap.interactionsThisPeriod).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("Permissions + tenant isolation", () => {
  it("lets every role view billing", () => {
    for (const role of ROLES) expect(hasPermission(role, "billing.view")).toBe(true);
  });

  it("lets only owner/admin manage billing", () => {
    expect(hasPermission("owner", "billing.manage")).toBe(true);
    expect(hasPermission("admin", "billing.manage")).toBe(true);
    expect(hasPermission("builder", "billing.manage")).toBe(false);
    expect(hasPermission("viewer", "billing.manage")).toBe(false);
  });

  it("keeps subscriptions organization-scoped (no cross-org leakage)", async () => {
    const store = new InMemoryStore();
    const orgA = await makeOrg(store, "alpha");
    const orgB = await makeOrg(store, "beta");

    await startPlanChange(store, { organizationId: orgA, userId: "uA" }, SIMULATED, "scale", {
      successUrl: "https://app/x",
      cancelUrl: "https://app/y",
    });

    // Org B is untouched by Org A's upgrade.
    expect((await getOrganizationPlan(store, orgA)).id).toBe("scale");
    expect((await getOrganizationPlan(store, orgB)).id).toBe("starter");
  });
});

// ---------------------------------------------------------------------------

describe("Webhook application (org resolved from stored ids only)", () => {
  it("ignores events that map to no known organization (deny-by-default)", async () => {
    const store = new InMemoryStore();
    const event: BillingWebhookEvent = {
      type: "subscription.updated",
      externalCustomerId: "cus_unknown",
      externalSubscriptionId: "sub_unknown",
      planId: "scale",
      status: "active",
      cancelAtPeriodEnd: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      externalEventId: "evt_1",
    };
    expect(await applyWebhookEvent(store, event)).toBe(false);
  });

  it("updates the subscription resolved via a stored customer mapping", async () => {
    const store = new InMemoryStore();
    const orgId = await makeOrg(store, "hookco");
    await store.upsertBillingCustomer({
      organizationId: orgId,
      externalCustomerId: "cus_123",
      provider: "stripe",
    });

    const applied = await applyWebhookEvent(store, {
      type: "subscription.updated",
      externalCustomerId: "cus_123",
      externalSubscriptionId: "sub_123",
      planId: "growth",
      status: "past_due",
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      externalEventId: "evt_2",
    });
    expect(applied).toBe(true);

    const sub = await store.getBillingSubscription(orgId);
    expect(sub!.planId).toBe("growth");
    expect(sub!.status).toBe("past_due");
    expect(sub!.externalSubscriptionId).toBe("sub_123");
  });

  it("ignores unparseable / irrelevant payloads without throwing", () => {
    expect(SIMULATED.parseWebhookEvent("{ not json")).toBeNull();
    const ignored = SIMULATED.parseWebhookEvent(JSON.stringify({ type: "something.else" }));
    expect(ignored?.type).toBe("ignored");
  });
});

import { describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { PLANS } from "@/modules/billing/plans";
import { assertWithinInteractionQuota, EntitlementError } from "@/modules/billing/service";
import {
  getOverageSummary,
  overageUnitPriceUsd,
  reportPeriodOverage,
  setOveragePolicy,
  setOverageSpendCap,
  OverageSettingError,
} from "@/modules/billing/overage";
import { setModelAccessMode } from "@/modules/usage/access-mode";
import { buildMarginReport, getMarginReport } from "@/modules/usage/operator";
import { SimulatedBillingProvider } from "@/modules/billing/providers/simulated";
import type { BillingProvider } from "@/modules/billing/providers/types";
import { hasPermission } from "@/modules/organizations/roles";

const SIMULATED = new SimulatedBillingProvider();
const STARTER_QUOTA = PLANS.starter.entitlements.monthlyInteractionQuota;

async function makeOrg(store: InMemoryStore, name: string) {
  const user = await store.createUser({ email: `${name}@example.com` });
  const view = await store.createOrganizationWithOwner({
    organization: { name, slug: name },
    ownerUserId: user.id,
  });
  return { orgId: view.organization.id, userId: user.id };
}

/** Emit one billable (employee_chat, success) usage event. */
async function emitBillable(store: InMemoryStore, orgId: string) {
  await store.createLlmUsageEvent({
    organizationId: orgId,
    providerSlug: "openai",
    modelId: "gpt-5.4-mini",
    taskType: "employee_chat",
    inputTokens: 10,
    outputTokens: 5,
    status: "success",
    costUsd: 0.0005,
    byok: false,
  });
}

/** Fill the org's usage to exactly its quota so the next interaction is overage. */
async function fillToQuota(store: InMemoryStore, orgId: string) {
  for (let i = 0; i < STARTER_QUOTA; i++) await emitBillable(store, orgId);
}

async function currentSub(store: InMemoryStore, orgId: string) {
  const sub = await store.getBillingSubscription(orgId);
  if (!sub) throw new Error("no subscription");
  return sub;
}

// ===========================================================================
// Hard cap (default) — blocks at quota, no overage
// ===========================================================================
describe("Hard cap (default)", () => {
  it("blocks at quota with an upgrade message and accrues no overage line", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "hardcap");
    await fillToQuota(store, orgId);

    await expect(assertWithinInteractionQuota(store, orgId)).rejects.toBeInstanceOf(EntitlementError);

    const sub = await currentSub(store, orgId);
    expect(sub.overagePolicy).toBe("hard_cap"); // default
    expect(await store.listBillingOverageItems(orgId, sub.currentPeriodStart)).toHaveLength(0);
  });
});

// ===========================================================================
// Managed pay-as-you-go — accrues overage past quota
// ===========================================================================
describe("Managed pay-as-you-go", () => {
  it("continues past quota and accrues one line per interaction at the snapshot price", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "payg");
    await setOveragePolicy(store, { organizationId: orgId, userId }, "pay_as_you_go");
    await fillToQuota(store, orgId);

    const unit = overageUnitPriceUsd();
    // Three further interactions: assert (meters) then emit the usage event.
    for (let i = 0; i < 3; i++) {
      const decision = await assertWithinInteractionQuota(store, orgId);
      expect(decision.allowed).toBe(true);
      await emitBillable(store, orgId);
    }

    const sub = await currentSub(store, orgId);
    const items = await store.listBillingOverageItems(orgId, sub.currentPeriodStart);
    // Quantity derived from usage events: total billable - quota = 3.
    const totalBillable = await store.countBillableInteractionsSince(orgId, sub.currentPeriodStart);
    expect(totalBillable - STARTER_QUOTA).toBe(3);
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.unitPriceUsd).toBe(unit);
      expect(item.amountUsd).toBe(unit);
      expect(item.provider).toBe("simulated");
      expect(item.status).toBe("pending");
    }
  });

  it("summarizes overage-to-date, the rate, and the simulated (not charged) state", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "paygsum");
    await setOveragePolicy(store, { organizationId: orgId, userId }, "pay_as_you_go");
    await fillToQuota(store, orgId);
    for (let i = 0; i < 2; i++) {
      await assertWithinInteractionQuota(store, orgId);
      await emitBillable(store, orgId);
    }
    const summary = await getOverageSummary(
      store,
      orgId,
      "managed",
      await currentSub(store, orgId),
      SIMULATED,
    );
    expect(summary.policy).toBe("pay_as_you_go");
    expect(summary.eligible).toBe(true);
    expect(summary.quantityThisPeriod).toBe(2);
    expect(summary.amountThisPeriodUsd).toBeCloseTo(2 * overageUnitPriceUsd(), 5);
    expect(summary.simulated).toBe(true);
  });
});

// ===========================================================================
// Spend cap
// ===========================================================================
describe("Overage spend cap", () => {
  it("reverts to hard-cap once the cap is reached; never charges beyond it", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "cap");
    const actor = { organizationId: orgId, userId };
    await setOveragePolicy(store, actor, "pay_as_you_go");
    // Cap allows exactly two overage interactions.
    const unit = overageUnitPriceUsd();
    await setOverageSpendCap(store, actor, unit * 2);
    await fillToQuota(store, orgId);

    // Two allowed…
    for (let i = 0; i < 2; i++) {
      await expect(assertWithinInteractionQuota(store, orgId)).resolves.toMatchObject({
        allowed: true,
      });
      await emitBillable(store, orgId);
    }
    // …the third is blocked by the cap.
    const err = await assertWithinInteractionQuota(store, orgId).catch((e) => e);
    expect(err).toBeInstanceOf(EntitlementError);
    expect(err.message).toMatch(/spend cap/i);

    const sub = await currentSub(store, orgId);
    const items = await store.listBillingOverageItems(orgId, sub.currentPeriodStart);
    expect(items).toHaveLength(2);
    const total = items.reduce((s, i) => s + i.amountUsd, 0);
    expect(total).toBeLessThanOrEqual(unit * 2);
  });
});

// ===========================================================================
// BYOK never accrues
// ===========================================================================
describe("BYOK organizations", () => {
  it("never accrues overage and cannot enable pay-as-you-go", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "byok");
    const actor = { organizationId: orgId, userId };
    await setModelAccessMode(store, actor, "byok");

    // Enabling pay-as-you-go is refused for a BYOK org.
    await expect(setOveragePolicy(store, actor, "pay_as_you_go")).rejects.toBeInstanceOf(
      OverageSettingError,
    );

    await fillToQuota(store, orgId);
    // Over quota → blocked (no metering), and no overage line is written.
    await expect(assertWithinInteractionQuota(store, orgId)).rejects.toBeInstanceOf(EntitlementError);
    const sub = await currentSub(store, orgId);
    expect(await store.listBillingOverageItems(orgId, sub.currentPeriodStart)).toHaveLength(0);
  });
});

// ===========================================================================
// Provider reporting (simulated vs live/fake) — no network
// ===========================================================================
describe("Provider reporting", () => {
  // Unique-ish org names without Date/random.
  let seq = 0;
  async function makeOverageOrg(store: InMemoryStore) {
    seq += 1;
    const { orgId, userId } = await makeOrg(store, `rep${seq}`);
    await setOveragePolicy(store, { organizationId: orgId, userId }, "pay_as_you_go");
    await fillToQuota(store, orgId);
    for (let i = 0; i < 2; i++) {
      await assertWithinInteractionQuota(store, orgId);
      await emitBillable(store, orgId);
    }
    return { orgId, userId };
  }

  it("simulated mode accrues but does not charge (lines stay pending)", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOverageOrg(store);
    const sub = await currentSub(store, orgId);
    const result = await reportPeriodOverage(store, SIMULATED, orgId, sub);
    expect(result.mode).toBe("simulated");
    expect(result.reported).toBe(0);
    const items = await store.listBillingOverageItems(orgId, sub.currentPeriodStart);
    expect(items.every((i) => i.status === "pending")).toBe(true);
  });

  it("live mode reports usage to the provider (fake — no network) and marks lines reported", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOverageOrg(store);
    const sub = await currentSub(store, orgId);
    // Give the org a live subscription id so reporting is possible.
    await store.updateBillingSubscription(orgId, { externalSubscriptionId: "sub_live_1" });

    const reported: number[] = [];
    const fakeStripe: BillingProvider = {
      ...SIMULATED,
      mode: "stripe",
      async reportOverageUsage(input) {
        reported.push(input.quantity);
        return { mode: "reported", externalUsageRecordId: "mbur_1" };
      },
    };

    const result = await reportPeriodOverage(store, fakeStripe, orgId, await currentSub(store, orgId));
    expect(result.mode).toBe("stripe");
    expect(result.reported).toBe(2);
    expect(reported).toEqual([2]); // reported the period quantity once
    const items = await store.listBillingOverageItems(orgId, sub.currentPeriodStart);
    expect(items.every((i) => i.status === "reported")).toBe(true);
    expect(items[0].externalUsageRecordId).toBe("mbur_1");
  });
});

// ===========================================================================
// Isolation + permissions
// ===========================================================================
describe("Isolation & permissions", () => {
  it("keeps overage lines organization-scoped (no cross-org leakage)", async () => {
    const store = new InMemoryStore();
    const a = await makeOrg(store, "ov-a");
    const b = await makeOrg(store, "ov-b");
    await setOveragePolicy(store, { organizationId: a.orgId, userId: a.userId }, "pay_as_you_go");
    await fillToQuota(store, a.orgId);
    await assertWithinInteractionQuota(store, a.orgId);

    const subA = await currentSub(store, a.orgId);
    const subB = await currentSub(store, b.orgId);
    expect(await store.listBillingOverageItems(a.orgId, subA.currentPeriodStart)).toHaveLength(1);
    expect(await store.listBillingOverageItems(b.orgId, subB.currentPeriodStart)).toHaveLength(0);
  });

  it("only owner/admin may change overage settings (permission matrix)", () => {
    expect(hasPermission("owner", "billing.manage")).toBe(true);
    expect(hasPermission("admin", "billing.manage")).toBe(true);
    expect(hasPermission("builder", "billing.manage")).toBe(false);
    expect(hasPermission("viewer", "billing.manage")).toBe(false);
  });

  it("audits an overage policy change", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "audit");
    await setOveragePolicy(store, { organizationId: orgId, userId }, "pay_as_you_go");
    const audits = store._auditEvents().filter((e) => e.action === "billing.overage_policy_changed");
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata).toMatchObject({ previous: "hard_cap", next: "pay_as_you_go" });
  });
});

// ===========================================================================
// Operator margin includes overage
// ===========================================================================
describe("Operator margin with overage", () => {
  it("includes overage revenue and cost, segmented by access mode", () => {
    const report = buildMarginReport({
      subscriptions: [sub("managed-org", "starter"), sub("byok-org", "scale")],
      orgInfo: new Map([
        ["managed-org", { name: "Managed Co", accessMode: "managed" }],
        ["byok-org", { name: "BYOK Co", accessMode: "byok" }],
      ]),
      aggregates: new Map([
        ["managed-org", agg("managed-org", { totalCostUsd: 1, interactions: 110 })],
        ["byok-org", agg("byok-org", { totalCostUsd: 0, interactions: 500, byok: 500 })],
      ]),
      overageByOrg: new Map([["managed-org", { organizationId: "managed-org", quantity: 10, amountUsd: 0.3 }]]),
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-02-01T00:00:00.000Z",
    });

    const rows = Object.fromEntries(report.byOrganization.map((r) => [r.organizationId, r]));
    const managed = rows["managed-org"];
    expect(managed.overageQuantity).toBe(10);
    expect(managed.overageRevenueUsd).toBeCloseTo(0.3, 5);
    // Free plan (revenue 0) → blended revenue is the overage.
    expect(managed.revenueUsd).toBeCloseTo(0.3, 5);
    // Overage cost approximated from the blended per-interaction cost (1/110 * 10).
    expect(managed.overageCostUsd).toBeGreaterThan(0);
    // BYOK org has no overage and no serving cost.
    expect(rows["byok-org"].overageRevenueUsd).toBe(0);

    expect(report.totals.overageRevenueUsd).toBeCloseTo(0.3, 5);
  });

  it("reflects an org's accrued overage end-to-end (getMarginReport)", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "e2e-margin");
    await setOveragePolicy(store, { organizationId: orgId, userId }, "pay_as_you_go");
    await fillToQuota(store, orgId);
    for (let i = 0; i < 4; i++) {
      await assertWithinInteractionQuota(store, orgId);
      await emitBillable(store, orgId);
    }
    const report = await getMarginReport(store, { since: new Date("2000-01-01T00:00:00.000Z") });
    const row = report.byOrganization.find((r) => r.organizationId === orgId);
    expect(row?.overageQuantity).toBe(4);
    expect(row?.overageRevenueUsd).toBeCloseTo(4 * overageUnitPriceUsd(), 5);
  });
});

function sub(organizationId: string, planId: "starter" | "growth" | "scale") {
  return {
    id: `sub-${organizationId}`,
    organizationId,
    planId,
    status: "active" as const,
    currentPeriodStart: "2026-01-01T00:00:00.000Z",
    currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    externalSubscriptionId: null,
    externalCustomerId: null,
    provider: "simulated",
    overagePolicy: "pay_as_you_go" as const,
    overageSpendCapUsd: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function agg(
  organizationId: string,
  opts: { totalCostUsd: number; interactions: number; byok?: number },
) {
  const byok = opts.byok ?? 0;
  return {
    organizationId,
    interactionCount: opts.interactions,
    managedInteractionCount: opts.interactions - byok,
    byokInteractionCount: byok,
    totalCostUsd: opts.totalCostUsd,
  };
}

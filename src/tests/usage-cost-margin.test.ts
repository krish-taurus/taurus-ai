import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { LlmGateway } from "@/modules/model-gateway/gateway";
import { updateEmployeeBrain } from "@/modules/model-gateway/service";
import type { LLMProvider } from "@/modules/model-gateway/types";
import type { CreateLlmUsageEventInput, ProviderSlug } from "@/lib/db/types";
import { MODEL_PROVIDERS } from "@/modules/model-gateway/catalog";
import { hasPermission } from "@/modules/organizations/roles";
import { PLANS } from "@/modules/billing/plans";
import {
  computeInteractionCost,
  costTierForModelId,
  isManagedAllowedModelId,
  DEFAULT_EMPLOYEE_MODEL_ID,
  managedInteractionPriceUsd,
} from "@/modules/usage/model-pricing";
import { buildUsageOverview, getUsageOverview } from "@/modules/usage/service";
import { channelGroupFor, quotaBannerLevel } from "@/modules/usage/metadata";
import { buildMarginReport, getMarginReport, isPlatformOperator } from "@/modules/usage/operator";
import { setModelAccessMode } from "@/modules/usage/access-mode";

// Operator allowlist for isPlatformOperator — set before the first getServerEnv().
const PRIOR_OPERATORS = process.env.PLATFORM_OPERATOR_USER_IDS;
beforeAll(() => {
  process.env.PLATFORM_OPERATOR_USER_IDS = "operator-1, operator-2";
});
afterAll(() => {
  if (PRIOR_OPERATORS === undefined) delete process.env.PLATFORM_OPERATOR_USER_IDS;
  else process.env.PLATFORM_OPERATOR_USER_IDS = PRIOR_OPERATORS;
});

async function makeOrg(store: InMemoryStore, name: string) {
  const user = await store.createUser({ email: `${name}@example.com` });
  const view = await store.createOrganizationWithOwner({
    organization: { name, slug: name },
    ownerUserId: user.id,
  });
  return { orgId: view.organization.id, userId: user.id };
}

/** A billable interaction usage event with an explicit cost (for aggregates). */
function billable(
  organizationId: string,
  patch: Partial<CreateLlmUsageEventInput> = {},
): CreateLlmUsageEventInput {
  return {
    organizationId,
    providerSlug: "openai",
    modelId: "gpt-5.4-mini",
    taskType: "employee_chat",
    inputTokens: 100,
    outputTokens: 50,
    status: "success",
    costUsd: 0.001,
    byok: false,
    ...patch,
  };
}

function fakeRegistry(): Record<ProviderSlug, LLMProvider> {
  const make = (slug: ProviderSlug): LLMProvider => ({
    slug,
    async generateText() {
      return {
        text: "reply",
        inputTokens: 1_000,
        cachedInputTokens: 0,
        outputTokens: 500,
        rawProviderRequestId: "req_1",
        finishReason: "stop",
      };
    },
  });
  return Object.fromEntries(MODEL_PROVIDERS.map((p) => [p.slug, make(p.slug)])) as Record<
    ProviderSlug,
    LLMProvider
  >;
}

// ===========================================================================
// Cost computation + pricing catalog
// ===========================================================================
describe("Model pricing + cost computation", () => {
  it("classifies cost tiers (budget / standard / premium) with deny-by-default", () => {
    expect(costTierForModelId("gpt-5.4-mini")).toBe("budget"); // $0.15/M
    expect(costTierForModelId("claude-sonnet-5")).toBe("mid"); // $3/M
    expect(costTierForModelId("claude-opus-4-8")).toBe("frontier"); // $15/M
    // Unknown model → frontier (most restrictive), never silently budget.
    expect(costTierForModelId("not-a-real-model")).toBe("frontier");
    expect(isManagedAllowedModelId("gpt-5.4-mini")).toBe(true);
    expect(isManagedAllowedModelId("claude-opus-4-8")).toBe(false);
  });

  it("computes a budget model's cost and stores the price snapshot", () => {
    const snap = computeInteractionCost({
      modelId: "gpt-5.4-mini",
      inputTokens: 1_000_000,
      cachedInputTokens: 0,
      outputTokens: 1_000_000,
      byok: false,
    });
    // 1M input @ $0.15 + 1M output @ $0.60 = $0.75.
    expect(snap.costUsd).toBeCloseTo(0.75, 5);
    expect(snap.unitInputPrice).toBe(0.15);
    expect(snap.unitOutputPrice).toBe(0.6);
    expect(snap.costTier).toBe("budget");
    expect(snap.byok).toBe(false);
  });

  it("costs a frontier model much higher than a budget model", () => {
    const budget = computeInteractionCost({
      modelId: "gpt-5.4-mini",
      inputTokens: 100_000,
      cachedInputTokens: 0,
      outputTokens: 100_000,
      byok: false,
    });
    const frontier = computeInteractionCost({
      modelId: "claude-opus-4-8",
      inputTokens: 100_000,
      cachedInputTokens: 0,
      outputTokens: 100_000,
      byok: false,
    });
    expect(frontier.costUsd).toBeGreaterThan(budget.costUsd * 10);
    expect(frontier.costTier).toBe("frontier");
  });

  it("charges nothing to Taurus for a BYOK interaction", () => {
    const snap = computeInteractionCost({
      modelId: "claude-opus-4-8",
      inputTokens: 1_000_000,
      cachedInputTokens: 0,
      outputTokens: 1_000_000,
      byok: true,
    });
    expect(snap.costUsd).toBe(0);
    expect(snap.byok).toBe(true);
  });

  it("applies the prompt-cache discount (cached input billed at the cached rate)", () => {
    const noCache = computeInteractionCost({
      modelId: "gpt-5.4-mini",
      inputTokens: 1_000_000,
      cachedInputTokens: 0,
      outputTokens: 0,
      byok: false,
    });
    const cached = computeInteractionCost({
      modelId: "gpt-5.4-mini",
      inputTokens: 0,
      cachedInputTokens: 1_000_000,
      outputTokens: 0,
      byok: false,
    });
    // Cached input ($0.015/M) is cheaper than full input ($0.15/M) — never higher.
    expect(cached.costUsd).toBeLessThan(noCache.costUsd);
    expect(cached.costUsd).toBeGreaterThan(0);
  });

  it("defines a budget-tier default employee model and a displayed managed sell price", () => {
    expect(costTierForModelId(DEFAULT_EMPLOYEE_MODEL_ID)).toBe("budget");
    expect(managedInteractionPriceUsd("mid")).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Cost capture at the gateway (managed records cost; BYOK is 0)
// ===========================================================================
describe("Gateway records cost on every billable interaction", () => {
  async function runOne(mode: "taurus_managed" | "bring_your_own_key") {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, `cap-${mode}`);
    // Pin to a budget model so managed mode allows it.
    await store.updateOrganizationModelSettings(orgId, {
      routingMode: "manual",
      defaultModelId: "gpt-5.4-mini",
    });
    const gateway = new LlmGateway({
      store,
      providers: fakeRegistry(),
      resolveCredential: async () => ({ apiKey: "k", baseUrl: null, mode }),
    });
    await gateway.generateText({
      organizationId: orgId,
      taskType: "employee_chat",
      messages: [{ role: "user", content: "hi" }],
      channelType: "hosted_chat",
    });
    const events = await store.listLlmUsageEvents(orgId, 10);
    return events[0];
  }

  it("stores tokens, model, price snapshot, cost, and channel for a managed interaction", async () => {
    const event = await runOne("taurus_managed");
    expect(event.modelId).toBe("gpt-5.4-mini");
    expect(event.inputTokens).toBe(1_000);
    expect(event.outputTokens).toBe(500);
    expect(event.byok).toBe(false);
    expect(event.costUsd).toBeGreaterThan(0);
    expect(event.unitInputPrice).toBe(0.15);
    expect(event.channelType).toBe("hosted_chat");
  });

  it("records cost 0 (byok=true) when the interaction runs on the customer's key", async () => {
    const event = await runOne("bring_your_own_key");
    expect(event.byok).toBe(true);
    expect(event.costUsd).toBe(0);
  });
});

// ===========================================================================
// Usage dashboard (quota from plan, usage from events; banners)
// ===========================================================================
describe("Usage overview", () => {
  it("reads the quota from the plan and usage from events (no parallel counter)", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "usg");
    const emp = await store.createEmployee({
      organizationId: orgId,
      name: "Nova",
      roleTitle: "Support",
      status: "active",
      createdBy: null,
    });
    // 3 billable interactions across two channels + a non-billable event (ignored).
    await store.createLlmUsageEvent(billable(orgId, { employeeId: emp.id, channelType: "hosted_chat" }));
    await store.createLlmUsageEvent(billable(orgId, { employeeId: emp.id, channelType: "whatsapp" }));
    await store.createLlmUsageEvent(billable(orgId, { employeeId: emp.id, channelType: "phone_call", taskType: "voice_realtime" }));
    await store.createLlmUsageEvent(billable(orgId, { taskType: "knowledge_summary" }));

    const overview = await getUsageOverview(store, orgId);
    expect(overview.interactionLimit).toBe(PLANS.starter.entitlements.monthlyInteractionQuota);
    expect(overview.interactionsUsed).toBe(3); // non-billable excluded
    expect(overview.byEmployee[0]?.label).toBe("Nova");
    expect(overview.byEmployee[0]?.interactions).toBe(3);
    const channels = Object.fromEntries(overview.byChannel.map((r) => [r.key, r.interactions]));
    expect(channels.web).toBe(1);
    expect(channels.messaging).toBe(1);
    expect(channels.voice).toBe(1);
  });

  it("flags the 80% and 100% quota banner thresholds", () => {
    const limit = 100;
    expect(quotaBannerLevel(0, limit)).toBe("ok");
    expect(quotaBannerLevel(79, limit)).toBe("ok");
    expect(quotaBannerLevel(80, limit)).toBe("approaching");
    expect(quotaBannerLevel(100, limit)).toBe("reached");
    expect(quotaBannerLevel(120, limit)).toBe("reached");
    // Unlimited quota is always ok.
    expect(quotaBannerLevel(9_999, Infinity)).toBe("ok");
  });

  it("groups channels into customer-facing buckets", () => {
    expect(channelGroupFor("website_widget")).toBe("web");
    expect(channelGroupFor("sms")).toBe("messaging");
    expect(channelGroupFor("email")).toBe("email");
    expect(channelGroupFor("phone_call")).toBe("voice");
    expect(channelGroupFor(null)).toBe("other");
  });

  it("builds a dense daily trend across the period", () => {
    const overview = buildUsageOverview({
      plan: PLANS.growth,
      subscription: {
        id: "s",
        organizationId: "o",
        planId: "growth",
        status: "active",
        currentPeriodStart: "2026-01-01T00:00:00.000Z",
        currentPeriodEnd: "2026-02-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        externalSubscriptionId: null,
        externalCustomerId: null,
        provider: "simulated",
        overagePolicy: "hard_cap",
        overageSpendCapUsd: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      events: [],
      employees: [],
      now: new Date("2026-01-05T12:00:00.000Z"),
    });
    // Jan 1..Jan 5 inclusive.
    expect(overview.trend).toHaveLength(5);
    expect(overview.trend[0].date).toBe("2026-01-01");
  });

  it("keeps usage strictly organization-scoped (no cross-org leakage)", async () => {
    const store = new InMemoryStore();
    const a = await makeOrg(store, "iso-a");
    const b = await makeOrg(store, "iso-b");
    await store.createLlmUsageEvent(billable(a.orgId));
    await store.createLlmUsageEvent(billable(a.orgId));
    await store.createLlmUsageEvent(billable(b.orgId));

    expect((await getUsageOverview(store, a.orgId)).interactionsUsed).toBe(2);
    expect((await getUsageOverview(store, b.orgId)).interactionsUsed).toBe(1);
  });
});

// ===========================================================================
// Operator gate + margin
// ===========================================================================
describe("Operator gate", () => {
  it("allows only allowlisted platform operators (deny-by-default)", () => {
    expect(isPlatformOperator("operator-1")).toBe(true);
    expect(isPlatformOperator("operator-2")).toBe(true);
    // A normal user — even an org owner — is not an operator.
    expect(isPlatformOperator("some-org-owner")).toBe(false);
    expect(isPlatformOperator(null)).toBe(false);
    expect(isPlatformOperator("")).toBe(false);
  });
});

describe("Margin report", () => {
  it("computes revenue, cost, margin %, markup, and the at-risk flag", () => {
    const report = buildMarginReport({
      subscriptions: [
        sub("free-org", "starter"),
        sub("healthy-org", "growth"),
        sub("risky-org", "growth"),
        sub("byok-org", "scale"),
      ],
      orgInfo: new Map([
        ["free-org", { name: "Free Co", accessMode: "managed" }],
        ["healthy-org", { name: "Healthy Co", accessMode: "managed" }],
        ["risky-org", { name: "Risky Co", accessMode: "managed" }],
        ["byok-org", { name: "BYOK Co", accessMode: "byok" }],
      ]),
      aggregates: new Map([
        // Free plan (revenue $0) with any managed cost → at risk.
        ["free-org", agg("free-org", { totalCostUsd: 0.5, managed: 5 })],
        // Growth ($49) cost $4 → healthy (well under 33% = $16.17).
        ["healthy-org", agg("healthy-org", { totalCostUsd: 4, managed: 40 })],
        // Growth ($49) cost $25 → over 33% → at risk.
        ["risky-org", agg("risky-org", { totalCostUsd: 25, managed: 300 })],
        // BYOK → cost 0 → never at risk.
        ["byok-org", agg("byok-org", { totalCostUsd: 0, byok: 900 })],
      ]),
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-02-01T00:00:00.000Z",
    });

    const rows = Object.fromEntries(report.byOrganization.map((r) => [r.organizationId, r]));
    expect(rows["healthy-org"].revenueUsd).toBe(49);
    expect(rows["healthy-org"].costUsd).toBe(4);
    expect(rows["healthy-org"].marginPct).toBe(Math.round(((49 - 4) / 49) * 100));
    expect(rows["healthy-org"].markupMultiple).toBeCloseTo(49 / 4, 2);
    expect(rows["healthy-org"].atRisk).toBe(false);

    expect(rows["risky-org"].atRisk).toBe(true);
    expect(rows["free-org"].atRisk).toBe(true);
    expect(rows["free-org"].marginPct).toBeNull(); // revenue 0 → undefined %
    expect(rows["byok-org"].atRisk).toBe(false);
    expect(rows["byok-org"].markupMultiple).toBeNull(); // no cost → infinite markup

    // Aggregate totals.
    expect(report.totals.revenueUsd).toBe(0 + 49 + 49 + 199);
    expect(report.totals.costUsd).toBeCloseTo(29.5, 5);
    expect(report.atRiskCostSharePercent).toBe(33);
  });

  it("aggregates cross-tenant only behind the gate; tenant reads stay scoped", async () => {
    const store = new InMemoryStore();
    const a = await makeOrg(store, "mar-a");
    const b = await makeOrg(store, "mar-b");
    await store.createLlmUsageEvent(billable(a.orgId, { costUsd: 1 }));
    await store.createLlmUsageEvent(billable(b.orgId, { costUsd: 2 }));

    // Cross-tenant aggregate (operator-only) sees both orgs.
    const agg = await store.aggregateUsageCostsSince("2000-01-01T00:00:00.000Z");
    expect(agg).toHaveLength(2);

    // The tenant-scoped read only sees its own org.
    const aOnly = await store.listBillableUsageEventsSince(a.orgId, "2000-01-01T00:00:00.000Z");
    expect(aOnly.every((e) => e.organizationId === a.orgId)).toBe(true);

    const report = await getMarginReport(store, { since: new Date("2000-01-01T00:00:00.000Z") });
    expect(report.byOrganization).toHaveLength(2);
    expect(report.totals.costUsd).toBeCloseTo(3, 5);
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
    overagePolicy: "hard_cap" as const,
    overageSpendCapUsd: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function agg(
  organizationId: string,
  opts: { totalCostUsd: number; managed?: number; byok?: number },
) {
  const managed = opts.managed ?? 0;
  const byok = opts.byok ?? 0;
  return {
    organizationId,
    interactionCount: managed + byok,
    managedInteractionCount: managed,
    byokInteractionCount: byok,
    totalCostUsd: opts.totalCostUsd,
  };
}

// ===========================================================================
// Model access mode (Part E) + frontier gating
// ===========================================================================
describe("Model access mode", () => {
  it("defaults a new organization to managed", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "am-default");
    const org = await store.getOrganizationById(orgId);
    expect(org?.modelAccessMode).toBe("managed");
  });

  it("only owner/admin may change it (permission matrix)", () => {
    // Access-mode changes reuse model_hub.manage (owner/admin only).
    expect(hasPermission("owner", "model_hub.manage")).toBe(true);
    expect(hasPermission("admin", "model_hub.manage")).toBe(true);
    expect(hasPermission("builder", "model_hub.manage")).toBe(false);
    expect(hasPermission("viewer", "model_hub.manage")).toBe(false);
  });

  it("writes an audit event on change and is a no-op when unchanged", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "am-change");
    const actor = { organizationId: orgId, userId };

    const updated = await setModelAccessMode(store, actor, "byok");
    expect(updated.modelAccessMode).toBe("byok");
    const audits = store._auditEvents().filter((e) => e.action === "model_access_mode.changed");
    expect(audits).toHaveLength(1);
    expect(audits[0].metadata).toMatchObject({ previous: "managed", next: "byok" });

    // No-op change writes no further audit.
    await setModelAccessMode(store, actor, "byok");
    expect(
      store._auditEvents().filter((e) => e.action === "model_access_mode.changed"),
    ).toHaveLength(1);
  });

  it("rejects an invalid mode", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "am-bad");
    await expect(
      setModelAccessMode(store, { organizationId: orgId, userId }, "premium"),
    ).rejects.toThrow();
  });
});

describe("Frontier models are BYOK-only", () => {
  async function seedEmployee(store: InMemoryStore, orgId: string) {
    return store.createEmployee({
      organizationId: orgId,
      name: "Ada",
      roleTitle: "Analyst",
      status: "active",
      createdBy: null,
    });
  }

  it("blocks pinning a frontier model to an employee in managed mode", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "fr-managed");
    const emp = await seedEmployee(store, orgId);
    await expect(
      updateEmployeeBrain(store, { organizationId: orgId, userId }, emp.id, {
        selection: "advanced",
        modelId: "claude-opus-4-8",
      }),
    ).rejects.toThrow(/your own api key/i);
  });

  it("permits a frontier model once the org is in BYOK mode", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "fr-byok");
    const emp = await seedEmployee(store, orgId);
    await setModelAccessMode(store, { organizationId: orgId, userId }, "byok");
    const updated = await updateEmployeeBrain(store, { organizationId: orgId, userId }, emp.id, {
      selection: "advanced",
      modelId: "claude-opus-4-8",
    });
    expect(updated.modelId).toBe("claude-opus-4-8");
  });

  it("never runs a frontier model for a managed org even if requested", async () => {
    const store = new InMemoryStore();
    const { orgId } = await makeOrg(store, "fr-runtime");
    const emp = await seedEmployee(store, orgId);
    // Force an employee override to a frontier model (bypassing the brain gate).
    await store.updateEmployeeModelSettings(orgId, emp.id, {
      modelId: "claude-opus-4-8",
      routingMode: "manual",
    });
    const gateway = new LlmGateway({
      store,
      providers: fakeRegistry(),
      resolveCredential: async () => ({ apiKey: "k", baseUrl: null, mode: "taurus_managed" }),
    });
    const res = await gateway.generateText({
      organizationId: orgId,
      employeeId: emp.id,
      taskType: "employee_chat",
      messages: [{ role: "user", content: "hi" }],
    });
    // The managed guardrail filtered the frontier model out — a non-frontier
    // model served instead.
    expect(res.modelId).not.toBe("claude-opus-4-8");
    expect(isManagedAllowedModelId(res.modelId)).toBe(true);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1 } from "@/modules/employee-dna/schema";
import {
  PerformanceService,
  PerformanceLockedError,
  PerformancePermissionError,
  PerformanceNotFoundError,
  gradeCase,
  gradeCriterion,
  type Reviewer,
  type ReviewUsage,
} from "@/modules/performance";
import type { EmployeeRunner } from "@/modules/performance/runtime";
import type { Criterion, GradingMethod, ReviewCase } from "@/modules/performance/types";
import type { OrgContext } from "@/modules/performance/service";

// --- Fixtures ----------------------------------------------------------------

function crit(
  method: GradingMethod,
  expected: string | null,
  overrides: Partial<Criterion> = {},
): Criterion {
  return {
    id: `crit-${method}-${overrides.label ?? ""}`,
    organizationId: "org",
    scorecardId: "sc",
    label: overrides.label ?? method,
    guidance: "What good looks like.",
    method,
    expected,
    weight: overrides.weight ?? 1,
    passThreshold: overrides.passThreshold ?? 0.7,
    position: overrides.position ?? 0,
  };
}

function rcase(situation = "A customer asks about the refund policy.", expected: string | null = null): ReviewCase {
  return {
    id: "case-1",
    organizationId: "org",
    scorecardId: "sc",
    name: "Refund question",
    situation,
    expected,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const USAGE: ReviewUsage = {
  modelId: "gpt-5.4-mini",
  providerSlug: "openai",
  inputTokens: 40,
  cachedInputTokens: 0,
  outputTokens: 20,
  byok: false,
};

/** A reviewer that always returns the given score (with usage). */
function stubReviewer(score: number, byok = false): Reviewer {
  return {
    async grade() {
      return { score, reason: "Graded.", usage: { ...USAGE, byok } };
    },
  };
}

/** An employee runner that returns a fixed output (no cost recorded here). */
function stubRunner(output: string): EmployeeRunner {
  return { async run() { return { output, usage: null }; } };
}

async function makeGrowthOrg(store: InMemoryStore, name: string) {
  const user = await store.createUser({ email: `${name}@example.com` });
  const view = await store.createOrganizationWithOwner({
    organization: { name, slug: name },
    ownerUserId: user.id,
  });
  const orgId = view.organization.id;
  // Growth+ unlocks Performance Review.
  await store.updateBillingSubscription(orgId, { planId: "growth" });
  const ctx: OrgContext = { organizationId: orgId, userId: user.id, role: "owner" };
  return { orgId, userId: user.id, ctx };
}

async function seedEmployeeWithDna(store: InMemoryStore, orgId: string, userId: string) {
  const employee = await store.createEmployee({
    organizationId: orgId,
    name: "Nova",
    roleTitle: "Support",
    status: "active",
    createdBy: userId,
  });
  await store.saveEmployeeDnaDraft({
    organizationId: orgId,
    employeeId: employee.id,
    dna: createEmptyDnaV1(),
    userId,
  });
  await store.publishEmployeeDna({ organizationId: orgId, employeeId: employee.id, userId });
  return employee.id;
}

/** Create a scorecard with the given criteria + one case, returning its id. */
async function makeScorecard(
  store: InMemoryStore,
  ctx: OrgContext,
  criteria: Array<{ method: GradingMethod; expected: string | null; weight?: number }>,
) {
  const scorecard = await PerformanceService.createScorecard(store, ctx, { name: "Support quality" });
  let i = 0;
  for (const c of criteria) {
    await PerformanceService.addCriterion(store, ctx, {
      scorecardId: scorecard.id,
      label: `${c.method}-${i}`,
      guidance: "good",
      method: c.method,
      expected: c.expected,
      weight: c.weight ?? 1,
      position: i++,
    });
  }
  await PerformanceService.addReviewCase(store, ctx, {
    scorecardId: scorecard.id,
    name: "Case",
    situation: "How do refunds work?",
    expected: "Explains the 30-day refund window.",
  });
  return scorecard.id;
}

// ===========================================================================
// Deterministic grading (zero model calls)
// ===========================================================================
describe("Deterministic grading", () => {
  it("contains: passes when the output includes the expected text", async () => {
    const pass = await gradeCriterion(crit("contains", "refund"), "Our refund policy is 30 days.", rcase());
    expect(pass.score.passed).toBe(true);
    expect(pass.usage).toBeNull();
    const fail = await gradeCriterion(crit("contains", "warranty"), "Our refund policy is 30 days.", rcase());
    expect(fail.score.passed).toBe(false);
  });

  it("exact: passes only on a trimmed exact match", async () => {
    expect((await gradeCriterion(crit("exact", "Yes"), "  Yes  ", rcase())).score.passed).toBe(true);
    expect((await gradeCriterion(crit("exact", "Yes"), "Yes, absolutely", rcase())).score.passed).toBe(false);
  });

  it("regex: matches a valid pattern and fails an invalid one gracefully", async () => {
    expect((await gradeCriterion(crit("regex", "\\d{3}-\\d{4}"), "Call 555-1234.", rcase())).score.passed).toBe(true);
    // Invalid pattern must not throw — the criterion simply fails.
    const bad = await gradeCriterion(crit("regex", "([unclosed"), "anything", rcase());
    expect(bad.score.passed).toBe(false);
    expect(bad.score.reason).toMatch(/invalid/i);
  });

  it("no_refusal: fails when the output reads as a refusal", async () => {
    expect((await gradeCriterion(crit("no_refusal", null), "Sure — here's how.", rcase())).score.passed).toBe(true);
    expect((await gradeCriterion(crit("no_refusal", null), "I'm sorry, I can't help with that.", rcase())).score.passed).toBe(false);
  });

  it("a case fails if any criterion fails, and the weighted score is normalized", async () => {
    const criteria = [
      crit("contains", "refund", { weight: 3, label: "a" }),
      crit("contains", "warranty", { weight: 1, label: "b" }),
    ];
    const graded = await gradeCase(criteria, "Our refund policy is 30 days.", rcase());
    // One passes (weight 3, score 1), one fails (weight 1, score 0) → 0.75; case fails.
    expect(graded.passed).toBe(false);
    expect(graded.score).toBeCloseTo(0.75, 5);
    expect(graded.usages).toHaveLength(0);
  });
});

// ===========================================================================
// Reviewer grading (via stub — no real model)
// ===========================================================================
describe("Reviewer grading", () => {
  it("passes when the reviewer score meets the threshold and reports usage", async () => {
    const graded = await gradeCriterion(
      crit("reviewer", null, { passThreshold: 0.7 }),
      "A thorough answer.",
      rcase(),
      stubReviewer(0.9),
    );
    expect(graded.score.passed).toBe(true);
    expect(graded.score.score).toBeCloseTo(0.9, 5);
    expect(graded.usage).not.toBeNull();
  });

  it("fails below the threshold", async () => {
    const graded = await gradeCriterion(
      crit("reviewer", null, { passThreshold: 0.7 }),
      "Weak answer.",
      rcase(),
      stubReviewer(0.4),
    );
    expect(graded.score.passed).toBe(false);
  });

  it("a reviewer failure fails only that criterion without crashing the run", async () => {
    const throwing: Reviewer = {
      async grade() {
        throw new Error("model unavailable");
      },
    };
    const graded = await gradeCriterion(crit("reviewer", null), "answer", rcase(), throwing);
    expect(graded.score.passed).toBe(false);
    expect(graded.score.reason).toMatch(/could not grade/i);
  });

  it("model methods fail cleanly when no reviewer is configured", async () => {
    const graded = await gradeCriterion(crit("reviewer", null), "answer", rcase(), null);
    expect(graded.score.passed).toBe(false);
    expect(graded.score.reason).toMatch(/no reviewer/i);
  });
});

// ===========================================================================
// Service: runs, audit, usage-cost
// ===========================================================================
describe("PerformanceService runs", () => {
  it("records audit events on scorecard create and run start/complete", async () => {
    const store = new InMemoryStore();
    const { orgId, ctx } = await makeGrowthOrg(store, "runco");
    const employeeId = await seedEmployeeWithDna(store, orgId, ctx.userId);
    const scorecardId = await makeScorecard(store, ctx, [{ method: "contains", expected: "refund" }]);

    const { run } = await PerformanceService.startReviewRun(
      store,
      ctx,
      { scorecardId, employeeId },
      { employeeRunner: stubRunner("Our refund policy is 30 days."), reviewer: null },
    );
    expect(run.status).toBe("completed");
    expect(run.overallScore).toBeCloseTo(1, 5);
    expect(run.passedCases).toBe(1);

    const actions = store._auditEvents().map((e) => e.action);
    expect(actions).toContain("performance.scorecard_created");
    expect(actions).toContain("performance.run_started");
    expect(actions).toContain("performance.run_completed");
  });

  it("runs a deterministic-only scorecard with no model cost", async () => {
    const store = new InMemoryStore();
    const { orgId, ctx } = await makeGrowthOrg(store, "detco");
    const employeeId = await seedEmployeeWithDna(store, orgId, ctx.userId);
    const scorecardId = await makeScorecard(store, ctx, [{ method: "contains", expected: "refund" }]);

    await PerformanceService.startReviewRun(
      store,
      ctx,
      { scorecardId, employeeId },
      { employeeRunner: stubRunner("Our refund policy covers 30 days."), reviewer: null },
    );
    const usage = await store.listLlmUsageEvents(orgId, 100);
    expect(usage.filter((u) => u.taskType === "performance_review")).toHaveLength(0);
  });

  it("records a usage-cost event per model-graded case, with cost > 0", async () => {
    const store = new InMemoryStore();
    const { orgId, ctx } = await makeGrowthOrg(store, "gradeco");
    const employeeId = await seedEmployeeWithDna(store, orgId, ctx.userId);
    const scorecardId = await makeScorecard(store, ctx, [{ method: "reviewer", expected: null }]);

    await PerformanceService.startReviewRun(
      store,
      ctx,
      { scorecardId, employeeId },
      { employeeRunner: stubRunner("A great answer."), reviewer: stubReviewer(0.9) },
    );
    const usage = (await store.listLlmUsageEvents(orgId, 100)).filter(
      (u) => u.taskType === "performance_review",
    );
    expect(usage).toHaveLength(1);
    expect(usage[0].costUsd ?? 0).toBeGreaterThan(0);
    expect(usage[0].byok).toBe(false);
  });

  it("records cost 0 when grading runs on the customer's own key (BYOK)", async () => {
    const store = new InMemoryStore();
    const { orgId, ctx } = await makeGrowthOrg(store, "byokco");
    const employeeId = await seedEmployeeWithDna(store, orgId, ctx.userId);
    const scorecardId = await makeScorecard(store, ctx, [{ method: "reviewer", expected: null }]);

    await PerformanceService.startReviewRun(
      store,
      ctx,
      { scorecardId, employeeId },
      { employeeRunner: stubRunner("A great answer."), reviewer: stubReviewer(0.9, true) },
    );
    const usage = (await store.listLlmUsageEvents(orgId, 100)).filter(
      (u) => u.taskType === "performance_review",
    );
    expect(usage[0].byok).toBe(true);
    expect(usage[0].costUsd).toBe(0);
  });

  it("builds a trend across completed runs", async () => {
    const store = new InMemoryStore();
    const { orgId, ctx } = await makeGrowthOrg(store, "trendco");
    const employeeId = await seedEmployeeWithDna(store, orgId, ctx.userId);
    const scorecardId = await makeScorecard(store, ctx, [{ method: "contains", expected: "refund" }]);
    const ports = { employeeRunner: stubRunner("Refund in 30 days."), reviewer: null };

    await PerformanceService.startReviewRun(store, ctx, { scorecardId, employeeId }, ports);
    await PerformanceService.startReviewRun(store, ctx, { scorecardId, employeeId }, ports);
    const trend = await PerformanceService.getTrend(store, ctx, employeeId);
    expect(trend).toHaveLength(2);
    expect(trend[0].overallScore).toBeCloseTo(1, 5);
  });
});

// ===========================================================================
// Permissions, isolation, plan gating
// ===========================================================================
describe("Permissions & gating", () => {
  it("a viewer cannot start a run", async () => {
    const store = new InMemoryStore();
    const { orgId, ctx } = await makeGrowthOrg(store, "permco");
    const employeeId = await seedEmployeeWithDna(store, orgId, ctx.userId);
    const scorecardId = await makeScorecard(store, ctx, [{ method: "contains", expected: "x" }]);

    const viewerCtx: OrgContext = { ...ctx, role: "viewer" };
    await expect(
      PerformanceService.startReviewRun(
        store,
        viewerCtx,
        { scorecardId, employeeId },
        { employeeRunner: stubRunner("x"), reviewer: null },
      ),
    ).rejects.toBeInstanceOf(PerformancePermissionError);
  });

  it("cross-org access to a scorecard is denied (not found)", async () => {
    const store = new InMemoryStore();
    const a = await makeGrowthOrg(store, "orga");
    const b = await makeGrowthOrg(store, "orgb");
    const scorecardId = await makeScorecard(store, a.ctx, [{ method: "contains", expected: "x" }]);

    await expect(
      PerformanceService.getScorecardDetail(store, b.ctx, scorecardId),
    ).rejects.toBeInstanceOf(PerformanceNotFoundError);
  });

  it("a Starter org is refused a run server-side; Growth succeeds", async () => {
    const store = new InMemoryStore();
    // Starter org (default plan on creation).
    const user = await store.createUser({ email: "starter@example.com" });
    const view = await store.createOrganizationWithOwner({
      organization: { name: "starterco", slug: "starterco" },
      ownerUserId: user.id,
    });
    const ctx: OrgContext = { organizationId: view.organization.id, userId: user.id, role: "owner" };

    // Even creating a scorecard is gated to Growth+.
    await expect(
      PerformanceService.createScorecard(store, ctx, { name: "Blocked" }),
    ).rejects.toBeInstanceOf(PerformanceLockedError);

    // Upgrade to Growth → allowed.
    await store.updateBillingSubscription(view.organization.id, { planId: "growth" });
    const scorecard = await PerformanceService.createScorecard(store, ctx, { name: "Allowed" });
    expect(scorecard.name).toBe("Allowed");
  });
});

// ===========================================================================
// Store parity
// ===========================================================================
describe("Store parity", () => {
  it("every performance store method exists in BOTH backends", () => {
    const mem = readFileSync(join(process.cwd(), "src/lib/db/in-memory-store.ts"), "utf8");
    const pg = readFileSync(join(process.cwd(), "src/lib/db/postgres-store.ts"), "utf8");
    const methods = [
      "createScorecard",
      "getScorecard",
      "listScorecards",
      "getScorecardDetail",
      "createCriterion",
      "createReviewCase",
      "createReviewRun",
      "updateReviewRun",
      "getReviewRun",
      "listReviewRuns",
      "createReviewResult",
      "listReviewResults",
      "getPerformanceTrend",
    ];
    for (const m of methods) {
      expect(mem, `in-memory missing ${m}`).toContain(`async ${m}(`);
      expect(pg, `postgres missing ${m}`).toContain(`async ${m}(`);
    }
  });
});

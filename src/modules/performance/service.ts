/**
 * Performance Review service (Sprint 018) — server only.
 *
 * Orchestrates scorecards, review cases, and review runs over a DataStore + the
 * injected `EmployeeRunner` / `Reviewer` ports (no provider SDK here). Every
 * method takes an `OrgContext` and checks membership/permission first; the org is
 * always resolved from the session by the caller, never from client input.
 *
 * Growth+ only: runs are refused server-side for a Starter org (the plan's
 * `performanceReview` feature flag). Model-graded criteria record usage-cost
 * events (Sprint 016 capture: tokens, model, cost_usd, BYOK → 0); deterministic
 * grading adds no model calls.
 */

import type { DataStore } from "@/lib/db/store";
import type { ProviderSlug } from "@/lib/db/types";
import type { Role } from "@/modules/organizations/roles";
import { hasPermission } from "@/modules/organizations/roles";
import { getOrganizationPlan } from "@/modules/billing/service";
import { planIncludesFeature } from "@/modules/billing/entitlements";
import { computeInteractionCost } from "@/modules/usage/model-pricing";
import { gradeCase, type Reviewer } from "@/modules/performance/scoring";
import type { EmployeeRunner } from "@/modules/performance/runtime";
import type {
  CreateCriterionInput,
  CreateReviewCaseInput,
  CreateScorecardInput,
  Criterion,
  PerformancePoint,
  ReviewCase,
  ReviewResult,
  ReviewRun,
  Scorecard,
  ScorecardDetail,
} from "@/modules/performance/types";

export interface OrgContext {
  organizationId: string;
  userId: string;
  role: Role;
}

export class PerformanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerformanceError";
  }
}
/** Permission denied (server-side, not just hidden in the UI). */
export class PerformancePermissionError extends PerformanceError {}
/** Org-scoped lookup miss — cross-org access surfaces as not found. */
export class PerformanceNotFoundError extends PerformanceError {}
/** Performance Review is a Growth+ feature; Starter orgs are locked out. */
export class PerformanceLockedError extends PerformanceError {}

function assertView(ctx: OrgContext): void {
  if (!hasPermission(ctx.role, "performance.view")) {
    throw new PerformancePermissionError("You do not have access to Performance Review.");
  }
}

function assertManage(ctx: OrgContext): void {
  if (!hasPermission(ctx.role, "performance.manage")) {
    throw new PerformancePermissionError(
      "You do not have permission to create scorecards or start reviews.",
    );
  }
}

async function assertPerformanceEnabled(store: DataStore, organizationId: string): Promise<void> {
  const plan = await getOrganizationPlan(store, organizationId);
  if (!planIncludesFeature(plan, "performanceReview")) {
    throw new PerformanceLockedError(
      "Performance Review is available on the Growth and Scale plans. Upgrade to review your AI Employees.",
    );
  }
}

export interface PerformanceRunPorts {
  employeeRunner: EmployeeRunner;
  reviewer: Reviewer | null;
}

export interface StartRunInput {
  scorecardId: string;
  employeeId: string;
}

export interface ReviewRunOutcome {
  run: ReviewRun;
  results: ReviewResult[];
}

/** Build the pinned system context an Employee runs with for a review. */
function buildDnaContext(
  employee: { name: string; roleTitle: string },
  dna: unknown,
  versionNumber: number,
): string {
  return [
    `You are ${employee.name}, ${employee.roleTitle}.`,
    `Operate exactly according to this configuration (version ${versionNumber}):`,
    JSON.stringify(dna),
    `Respond to the situation as this AI Employee would for a real customer. Be concise.`,
  ].join("\n");
}

export const PerformanceService = {
  // --- Scorecards + cases (performance.manage) ----------------------------

  async createScorecard(
    store: DataStore,
    ctx: OrgContext,
    input: { name: string; description?: string | null },
  ): Promise<Scorecard> {
    assertManage(ctx);
    await assertPerformanceEnabled(store, ctx.organizationId);
    const payload: CreateScorecardInput = {
      organizationId: ctx.organizationId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      createdByUserId: ctx.userId,
    };
    const scorecard = await store.createScorecard(payload);
    await store.createAuditEvent({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      action: "performance.scorecard_created",
      targetType: "performance_scorecard",
      targetId: scorecard.id,
      metadata: { name: scorecard.name },
    });
    return scorecard;
  },

  async addCriterion(
    store: DataStore,
    ctx: OrgContext,
    input: Omit<CreateCriterionInput, "organizationId">,
  ): Promise<Criterion> {
    assertManage(ctx);
    await assertPerformanceEnabled(store, ctx.organizationId);
    await this.requireScorecard(store, ctx, input.scorecardId);
    return store.createCriterion({ ...input, organizationId: ctx.organizationId });
  },

  async addReviewCase(
    store: DataStore,
    ctx: OrgContext,
    input: Omit<CreateReviewCaseInput, "organizationId">,
  ): Promise<ReviewCase> {
    assertManage(ctx);
    await assertPerformanceEnabled(store, ctx.organizationId);
    await this.requireScorecard(store, ctx, input.scorecardId);
    return store.createReviewCase({ ...input, organizationId: ctx.organizationId });
  },

  // --- Reads (performance.view) -------------------------------------------

  async listScorecards(store: DataStore, ctx: OrgContext): Promise<Scorecard[]> {
    assertView(ctx);
    return store.listScorecards(ctx.organizationId);
  },

  async getScorecardDetail(
    store: DataStore,
    ctx: OrgContext,
    scorecardId: string,
  ): Promise<ScorecardDetail> {
    assertView(ctx);
    const detail = await store.getScorecardDetail(ctx.organizationId, scorecardId);
    if (!detail) throw new PerformanceNotFoundError("Scorecard not found.");
    return detail;
  },

  async requireScorecard(
    store: DataStore,
    ctx: OrgContext,
    scorecardId: string,
  ): Promise<Scorecard> {
    const scorecard = await store.getScorecard(ctx.organizationId, scorecardId);
    if (!scorecard) throw new PerformanceNotFoundError("Scorecard not found.");
    return scorecard;
  },

  async getRunOutcome(
    store: DataStore,
    ctx: OrgContext,
    runId: string,
  ): Promise<ReviewRunOutcome> {
    assertView(ctx);
    const run = await store.getReviewRun(ctx.organizationId, runId);
    if (!run) throw new PerformanceNotFoundError("Review run not found.");
    const results = await store.listReviewResults(ctx.organizationId, runId);
    return { run, results };
  },

  async listRuns(
    store: DataStore,
    ctx: OrgContext,
    filter: { employeeId?: string; scorecardId?: string },
  ): Promise<ReviewRun[]> {
    assertView(ctx);
    return store.listReviewRuns(ctx.organizationId, filter);
  },

  async getTrend(
    store: DataStore,
    ctx: OrgContext,
    employeeId: string,
  ): Promise<PerformancePoint[]> {
    assertView(ctx);
    return store.getPerformanceTrend(ctx.organizationId, employeeId);
  },

  // --- Run a review (performance.manage, Growth+) -------------------------

  async startReviewRun(
    store: DataStore,
    ctx: OrgContext,
    input: StartRunInput,
    ports: PerformanceRunPorts,
  ): Promise<ReviewRunOutcome> {
    assertManage(ctx);
    await assertPerformanceEnabled(store, ctx.organizationId);

    const detail = await store.getScorecardDetail(ctx.organizationId, input.scorecardId);
    if (!detail) throw new PerformanceNotFoundError("Scorecard not found.");
    if (detail.cases.length === 0) {
      throw new PerformanceError("Add at least one review case before running a review.");
    }
    const employee = await store.getEmployee(ctx.organizationId, input.employeeId);
    if (!employee) throw new PerformanceNotFoundError("AI Employee not found.");
    const dnaOverview = await store.getEmployeeDnaOverview(ctx.organizationId, input.employeeId);
    const published = dnaOverview.published;
    if (!published) {
      throw new PerformanceError("Publish this AI Employee's DNA before running a review.");
    }

    const run = await store.createReviewRun({
      organizationId: ctx.organizationId,
      scorecardId: input.scorecardId,
      employeeId: input.employeeId,
      dnaVersionId: published.id,
      dnaVersionNumber: published.versionNumber,
      totalCases: detail.cases.length,
      startedByUserId: ctx.userId,
    });
    await store.createAuditEvent({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      action: "performance.run_started",
      targetType: "performance_review_run",
      targetId: run.id,
      metadata: {
        scorecardId: input.scorecardId,
        employeeId: input.employeeId,
        dnaVersionNumber: published.versionNumber,
        cases: detail.cases.length,
      },
    });

    try {
      const dnaContext = buildDnaContext(employee, published.dna, published.versionNumber);
      let passedCases = 0;
      let scoreSum = 0;
      const results: ReviewResult[] = [];

      for (const reviewCase of detail.cases) {
        const produced = await ports.employeeRunner.run({
          organizationId: ctx.organizationId,
          employeeId: input.employeeId,
          situation: reviewCase.situation,
          dnaContext,
        });
        const graded = await gradeCase(
          detail.criteria,
          produced.output,
          reviewCase,
          ports.reviewer,
        );
        const result = await store.createReviewResult({
          organizationId: ctx.organizationId,
          runId: run.id,
          caseId: reviewCase.id,
          employeeOutput: produced.output,
          passed: graded.passed,
          score: graded.score,
          criterionScores: graded.criterionScores,
        });
        results.push(result);
        if (graded.passed) passedCases += 1;
        scoreSum += graded.score;

        // Record a usage-cost event for each model-graded (reviewer) call.
        for (const usage of graded.usages) {
          const snapshot = computeInteractionCost({
            modelId: usage.modelId,
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            outputTokens: usage.outputTokens,
            byok: usage.byok,
          });
          await store.createLlmUsageEvent({
            organizationId: ctx.organizationId,
            employeeId: input.employeeId,
            providerSlug: usage.providerSlug as ProviderSlug,
            modelId: usage.modelId,
            taskType: "performance_review",
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            outputTokens: usage.outputTokens,
            costUsd: snapshot.costUsd,
            unitInputPrice: snapshot.unitInputPrice,
            unitOutputPrice: snapshot.unitOutputPrice,
            byok: usage.byok,
            status: "success",
            createdByUserId: ctx.userId,
          });
        }
      }

      const overallScore = detail.cases.length > 0 ? scoreSum / detail.cases.length : 0;
      const completed =
        (await store.updateReviewRun(ctx.organizationId, run.id, {
          status: "completed",
          overallScore,
          passedCases,
          completedAt: new Date().toISOString(),
        })) ?? run;
      await store.createAuditEvent({
        organizationId: ctx.organizationId,
        actorType: "user",
        actorId: ctx.userId,
        action: "performance.run_completed",
        targetType: "performance_review_run",
        targetId: run.id,
        metadata: {
          overallScore,
          passedCases,
          totalCases: detail.cases.length,
          dnaVersionNumber: published.versionNumber,
        },
      });
      return { run: completed, results };
    } catch (err) {
      const message = err instanceof Error ? err.message : "The review run failed.";
      await store.updateReviewRun(ctx.organizationId, run.id, {
        status: "failed",
        error: message,
        completedAt: new Date().toISOString(),
      });
      await store.createAuditEvent({
        organizationId: ctx.organizationId,
        actorType: "user",
        actorId: ctx.userId,
        action: "performance.run_failed",
        targetType: "performance_review_run",
        targetId: run.id,
        metadata: { error: message },
      });
      throw err;
    }
  },
};

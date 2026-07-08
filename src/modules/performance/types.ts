/**
 * Performance Review (Sprint 018) — domain types.
 *
 * The evaluation capability, expressed in the AI Employee metaphor. Internal
 * words like eval / rubric / test case / grader NEVER appear in the UI. Every id
 * is organization-scoped; a child never references another org's parent.
 */

/**
 * How one criterion is graded:
 *   Deterministic (zero model calls, free):
 *     - "contains"    — the output contains the expected text (case-insensitive).
 *     - "exact"       — the output equals the expected text (trimmed).
 *     - "regex"       — the output matches the expected pattern.
 *     - "no_refusal"  — the output is not a refusal / non-answer.
 *   Model-graded (via the Reviewer port, records usage cost):
 *     - "reviewer"    — an AI Employee grades the output against the guidance.
 *     - "grounded"    — like reviewer, but also checks the answer is grounded in
 *                       the case's definition of good.
 */
export const GRADING_METHODS = [
  "contains",
  "exact",
  "regex",
  "no_refusal",
  "reviewer",
  "grounded",
] as const;
export type GradingMethod = (typeof GRADING_METHODS)[number];

export const DETERMINISTIC_METHODS: readonly GradingMethod[] = [
  "contains",
  "exact",
  "regex",
  "no_refusal",
];

export function isDeterministicMethod(method: GradingMethod): boolean {
  return DETERMINISTIC_METHODS.includes(method);
}

export function isModelGradedMethod(method: GradingMethod): boolean {
  return method === "reviewer" || method === "grounded";
}

/** The set of weighted criteria an Employee is measured on. */
export interface Scorecard {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One graded dimension of a scorecard. */
export interface Criterion {
  id: string;
  organizationId: string;
  scorecardId: string;
  /** Customer-facing name of the dimension. */
  label: string;
  /** What "good" looks like for this dimension (guides the reviewer + the UI). */
  guidance: string;
  method: GradingMethod;
  /** Expected text / pattern for deterministic methods; null otherwise. */
  expected: string | null;
  /** Relative weight in the case score (> 0). */
  weight: number;
  /** For model-graded methods: minimum 0–1 score to pass. */
  passThreshold: number;
  /** Display order within the scorecard. */
  position: number;
}

/** A real situation an Employee is reviewed against. */
export interface ReviewCase {
  id: string;
  organizationId: string;
  scorecardId: string;
  name: string;
  /** The input the Employee is given. */
  situation: string;
  /** The definition of good / notes for graders (never shown as "expected" in UI copy). */
  expected: string | null;
  createdAt: string;
}

export type ReviewRunStatus = "pending" | "running" | "completed" | "failed";

/** One execution of a scorecard against a specific Employee DNA version. */
export interface ReviewRun {
  id: string;
  organizationId: string;
  scorecardId: string;
  employeeId: string;
  /** The pinned DNA version, so a run is reproducible. */
  dnaVersionId: string;
  dnaVersionNumber: number;
  status: ReviewRunStatus;
  /** Weighted 0–1 score across all cases; null until completed. */
  overallScore: number | null;
  passedCases: number;
  totalCases: number;
  error: string | null;
  startedByUserId: string | null;
  startedAt: string;
  completedAt: string | null;
}

/** The graded score for one criterion within a case. */
export interface CriterionScore {
  criterionId: string;
  label: string;
  method: GradingMethod;
  passed: boolean;
  /** 0–1. Deterministic methods are 0 or 1. */
  score: number;
  weight: number;
  /** Human, non-technical reason for the score. */
  reason: string;
}

/** The graded output for one case within a run. */
export interface ReviewResult {
  id: string;
  organizationId: string;
  runId: string;
  caseId: string;
  /** The Employee's produced output for the case (stored to show the manager). */
  employeeOutput: string;
  passed: boolean;
  /** Weighted 0–1 score for this case. */
  score: number;
  criterionScores: CriterionScore[];
  createdAt: string;
}

/** A point on the performance trend (score over runs / DNA versions). */
export interface PerformancePoint {
  runId: string;
  dnaVersionNumber: number;
  overallScore: number;
  passRate: number;
  completedAt: string;
}

// --- Create inputs ------------------------------------------------------------

export interface CreateScorecardInput {
  organizationId: string;
  name: string;
  description?: string | null;
  createdByUserId?: string | null;
}

export interface CreateCriterionInput {
  organizationId: string;
  scorecardId: string;
  label: string;
  guidance: string;
  method: GradingMethod;
  expected?: string | null;
  weight: number;
  passThreshold?: number;
  position: number;
}

export interface CreateReviewCaseInput {
  organizationId: string;
  scorecardId: string;
  name: string;
  situation: string;
  expected?: string | null;
}

export interface CreateReviewRunInput {
  organizationId: string;
  scorecardId: string;
  employeeId: string;
  dnaVersionId: string;
  dnaVersionNumber: number;
  totalCases: number;
  startedByUserId?: string | null;
}

export interface CreateReviewResultInput {
  organizationId: string;
  runId: string;
  caseId: string;
  employeeOutput: string;
  passed: boolean;
  score: number;
  criterionScores: CriterionScore[];
}

export interface UpdateReviewRunInput {
  status?: ReviewRunStatus;
  overallScore?: number | null;
  passedCases?: number;
  error?: string | null;
  completedAt?: string | null;
}

export interface ReviewRunFilter {
  employeeId?: string;
  scorecardId?: string;
}

/** A scorecard with its criteria + cases (org-scoped read). */
export interface ScorecardDetail {
  scorecard: Scorecard;
  criteria: Criterion[];
  cases: ReviewCase[];
}
